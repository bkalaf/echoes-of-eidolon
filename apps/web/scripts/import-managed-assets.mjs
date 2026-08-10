import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { promisify } from "node:util";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";

import {
  assertManagedAssetSignature,
  finalByteIdentity,
  normalizeManagedExtension,
} from "./managed-asset-pipeline.mjs";

const execute = promisify(execFile);
const appRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(appRoot, "../..");
const configPath = resolve(repositoryRoot, process.argv[2] ?? ".local/assets/import-sources.json");
const localAssetRoot = resolve(repositoryRoot, "assets/managed");
const manifestPath = resolve(appRoot, "src/data/managed-assets.json");
const workingRoot = resolve(repositoryRoot, ".local/assets/work");

const mimeTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
};

function spacesLocation() {
  const driveUrl = new URL(process.env.DIGITALOCEAN_SPACES_DRIVE_URL ?? "");
  const host = driveUrl.hostname.split(".");
  const region = host.at(-3);
  const bucket = host.slice(0, -3).join(".");
  if (
    driveUrl.protocol !== "https:" ||
    driveUrl.pathname !== "/" ||
    host.at(-2) !== "digitaloceanspaces" ||
    host.at(-1) !== "com" ||
    !region ||
    !bucket
  ) {
    throw new Error("DIGITALOCEAN_SPACES_DRIVE_URL must be a bucket endpoint");
  }
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) throw new Error("DigitalOcean Spaces credentials are required");
  return {
    accessKeyId,
    baseUrl: driveUrl.origin,
    bucket,
    endpoint: `https://${region}.digitaloceanspaces.com`,
    region,
    secretAccessKey,
  };
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function assertFileSignature(path, extension) {
  assertManagedAssetSignature(await readFile(path), extension);
}

async function mediaSignature(path, extension) {
  if ([".png", ".jpg", ".jpeg"].includes(extension)) {
    const { stdout } = await execute("magick", ["identify", "-format", "%m|%w|%h|%[channels]|%[bit-depth]", path]);
    return stdout.trim();
  }
  const { stdout } = await execute("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,channels,sample_rate",
    "-of", "json",
    path,
  ]);
  const parsed = JSON.parse(stdout);
  return JSON.stringify({
    duration: Number(parsed.format?.duration ?? 0).toFixed(3),
    streams: parsed.streams,
  });
}

async function stripMetadata(source, target, extension) {
  await assertFileSignature(source, extension);
  const before = await mediaSignature(source, extension);
  if (extension === ".mp3") {
    await execute("ffmpeg", [
      "-v", "error", "-y", "-i", source,
      "-map", "0:a:0", "-map_metadata", "-1", "-c:a", "copy", "-id3v2_version", "0",
      target,
    ]);
  } else {
    await copyFile(source, target);
    await execute("exiftool", ["-overwrite_original", "-all=", target]);
  }
  const after = await mediaSignature(target, extension);
  await assertFileSignature(target, extension);
  if (before !== after) {
    throw new Error(`Metadata stripping changed the technical media signature for ${source}: ${before} -> ${after}`);
  }
}

function isMissingObject(error) {
  return error?.name === "NoSuchKey" || error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404;
}

async function verifyRemoteObject(client, input) {
  let remote;
  try {
    remote = await client.send(new GetObjectCommand({ Bucket: input.bucket, Key: input.objectKey }));
  } catch (error) {
    if (isMissingObject(error)) return false;
    throw error;
  }
  if (!remote.Body) throw new Error(`Remote object has no body: ${input.objectKey}`);

  const hash = createHash("sha256");
  let byteSize = 0;
  for await (const chunk of remote.Body) {
    hash.update(chunk);
    byteSize += chunk.byteLength;
  }
  if (
    hash.digest("hex") !== input.sha256 ||
    byteSize !== input.byteSize ||
    remote.ContentLength !== input.byteSize ||
    remote.ContentType !== input.mimeType
  ) {
    throw new Error(`Remote final-byte identity verification failed: ${input.objectKey}`);
  }
  return true;
}

async function collectEntries(config) {
  const entries = [...config.entries];
  for (const archive of config.archives ?? []) {
    const extractionRoot = resolve(workingRoot, "archives", archive.logicalPrefix);
    await mkdir(extractionRoot, { recursive: true });
    await execute("unzip", ["-qq", "-o", archive.source, "-d", extractionRoot]);
    for (const entry of archive.entries) {
      entries.push({ logicalKey: entry.logicalKey, source: resolve(extractionRoot, entry.path) });
    }
  }
  return entries;
}

function mediaKindForMimeType(mimeType) {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  if (mimeType.startsWith("video/")) return "VIDEO";
  throw new Error(`Unsupported managed asset MIME type: ${mimeType}`);
}

async function persistManifest(manifest) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to persist managed assets");
  const pool = new Pool({ connectionString: databaseUrl });
  const database = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await database.$transaction(async (transaction) => {
      for (const [purpose, record] of Object.entries(manifest)) {
        const managedAssetId = record.sha256;
        const asset = await transaction.managedAsset.upsert({
          where: { sha256: record.sha256 },
          create: {
            managedAssetId,
            sha256: record.sha256,
            objectKey: record.objectKey,
            mediaKind: mediaKindForMimeType(record.mimeType),
            mimeType: record.mimeType,
            byteSize: BigInt(record.byteSize),
          },
          update: {},
        });
        if (
          asset.objectKey !== record.objectKey ||
          asset.mediaKind !== mediaKindForMimeType(record.mimeType) ||
          asset.mimeType !== record.mimeType ||
          asset.byteSize !== BigInt(record.byteSize)
        ) {
          throw new Error(`Persisted final-byte identity conflicts with ${purpose}`);
        }
        await transaction.assetPurposeLink.upsert({
          where: { purpose },
          create: { assetPurposeLinkId: purpose, managedAssetId: asset.managedAssetId, purpose },
          update: { managedAssetId: asset.managedAssetId },
        });
      }
    });
  } finally {
    await database.$disconnect();
    await pool.end();
  }
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const location = spacesLocation();
  const client = new S3Client({
    endpoint: location.endpoint,
    region: location.region,
    credentials: { accessKeyId: location.accessKeyId, secretAccessKey: location.secretAccessKey },
  });
  await mkdir(localAssetRoot, { recursive: true });
  await mkdir(workingRoot, { recursive: true });

  const logicalKeys = new Set();
  const manifest = {};
  for (const entry of await collectEntries(config)) {
    if (logicalKeys.has(entry.logicalKey)) throw new Error(`Duplicate logical asset key: ${entry.logicalKey}`);
    logicalKeys.add(entry.logicalKey);
    const extension = extname(entry.source).toLowerCase();
    const normalizedExtension = normalizeManagedExtension(extension);
    const mimeType = mimeTypes[extension];
    if (!mimeType) throw new Error(`Unsupported managed asset extension: ${entry.source}`);
    const sourceInfo = await stat(entry.source);
    if (!sourceInfo.isFile()) throw new Error(`Managed asset source is not a file: ${entry.source}`);

    const temporaryPath = resolve(workingRoot, `${entry.logicalKey.replaceAll(/[^a-zA-Z0-9.-]/g, "-")}${extension}.tmp${extension}`);
    await stripMetadata(entry.source, temporaryPath, extension);
    const finalBytes = await readFile(temporaryPath);
    const { fileName, sha256: hash } = finalByteIdentity(finalBytes, normalizedExtension);
    const localPath = resolve(localAssetRoot, fileName);
    const objectKey = `assets/${fileName}`;
    const finalInfo = await stat(temporaryPath);
    try {
      const existingHash = await sha256(localPath);
      if (existingHash !== hash) throw new Error(`Local content-addressed collision: ${localPath}`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      await rename(temporaryPath, localPath);
    }

    const remoteIdentity = {
      bucket: location.bucket,
      byteSize: finalInfo.size,
      mimeType,
      objectKey,
      sha256: hash,
    };
    if (!await verifyRemoteObject(client, remoteIdentity)) {
      await client.send(new PutObjectCommand({
        ACL: "public-read",
        Body: createReadStream(localPath),
        Bucket: location.bucket,
        CacheControl: "public, max-age=31536000, immutable",
        ContentLength: finalInfo.size,
        ContentType: mimeType,
        Key: objectKey,
      }));
      if (!await verifyRemoteObject(client, remoteIdentity)) {
        throw new Error(`Uploaded object is unavailable: ${entry.logicalKey}`);
      }
    }

    manifest[entry.logicalKey] = {
      byteSize: finalInfo.size,
      mimeType,
      objectKey,
      publicUrl: `${location.baseUrl}/${objectKey}`,
      sha256: hash,
    };
    process.stdout.write(`${entry.logicalKey} ${hash} ${finalInfo.size}\n`);
  }

  await mkdir(dirname(manifestPath), { recursive: true });
  await persistManifest(manifest);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`manifest ${Object.keys(manifest).length} ${manifestPath}\n`);
}

await main();
