/* global fetch */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import process from "node:process";
import { URL } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";

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
const configArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const configPath = resolve(repositoryRoot, configArgument ?? ".local/assets/import-sources.json");
const verifyOnly = process.argv.includes("--verify-only");
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

async function technicalMetadata(path, extension) {
  if ([".png", ".jpg", ".jpeg"].includes(extension)) {
    const { stdout } = await execute("magick", [
      "identify", "-format", "%m|%w|%h|%[channels]|%[bit-depth]|%[profiles]", path,
    ]);
    const [format, width, height, channels, bitDepth, profiles] = stdout.trim().split("|");
    return {
      kind: "image",
      format,
      width: Number(width),
      height: Number(height),
      channels,
      bitDepth: Number(bitDepth),
      colorProfile: profiles || null,
    };
  }
  const { stdout } = await execute("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=index,codec_type,codec_name,width,height,r_frame_rate,channels,sample_rate:stream_tags=language,title",
    "-of", "json",
    path,
  ]);
  const parsed = JSON.parse(stdout);
  const result = {
    kind: extension === ".mp3" ? "audio" : "video",
    durationSeconds: Number(parsed.format?.duration ?? 0),
    streams: parsed.streams ?? [],
  };
  if (extension === ".mp3") {
    const { stderr } = await execute("ffmpeg", ["-hide_banner", "-nostats", "-i", path, "-af", "volumedetect", "-f", "null", "-"]);
    const mean = /mean_volume:\s*([^\s]+) dB/.exec(stderr)?.[1];
    const peak = /max_volume:\s*([^\s]+) dB/.exec(stderr)?.[1];
    return { ...result, meanVolumeDb: databaseJsonNumber(mean), peakVolumeDb: databaseJsonNumber(peak) };
  }
  return result;
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
  return technicalMetadata(target, extension);
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
    remote.ContentType !== input.mimeType ||
    remote.CacheControl !== "public, max-age=31536000, immutable"
  ) {
    throw new Error(`Remote final-byte identity verification failed: ${input.objectKey}`);
  }
  return true;
}

async function verifyPublicDelivery(input) {
  const requestHeaders = { Origin: input.corsOrigin };
  if (input.mimeType === "audio/mpeg" || input.mimeType === "video/mp4") {
    requestHeaders.Range = "bytes=0-0";
  }
  const response = await fetch(input.publicUrl, {
    headers: requestHeaders,
    method: input.mimeType.startsWith("image/") ? "HEAD" : "GET",
  });
  const expectedStatus = requestHeaders.Range ? 206 : 200;
  const allowedOrigin = response.headers.get("access-control-allow-origin");
  const corsMatches = allowedOrigin === "*" || allowedOrigin === input.corsOrigin;
  const contentRangeMatches = !requestHeaders.Range || /^bytes 0-0\/\d+$/.test(response.headers.get("content-range") ?? "");
  const failures = [];
  if (response.status !== expectedStatus) failures.push(`HTTP ${response.status}, expected ${expectedStatus}`);
  if (response.headers.get("content-type") !== input.mimeType) failures.push("MIME type");
  if (response.headers.get("cache-control") !== "public, max-age=31536000, immutable") failures.push("immutable cache control");
  if (!corsMatches) failures.push("CORS allow-origin");
  if (!contentRangeMatches) failures.push("byte range");
  if (failures.length > 0) {
    throw new Error(`Public delivery verification failed (${failures.join(", ")}): ${input.objectKey}`);
  }
}

async function collectEntries(config) {
  const entries = [...config.entries];
  for (const archive of config.archives ?? []) {
    const archiveWorkingRoot = resolve(workingRoot, "archives");
    await mkdir(archiveWorkingRoot, { recursive: true });
    const extractionRoot = await mkdtemp(join(archiveWorkingRoot, `${archive.logicalPrefix}-`));
    const expectedMembers = [
      ...archive.entries.map((entry) => entry.path),
      ...(archive.inventoryOnlyEntries ?? []),
    ];
    const { stdout } = await execute("python3", [
      resolve(import.meta.dirname, "safe-extract-zip.py"),
      archive.source,
      resolve(extractionRoot, "package"),
      ...expectedMembers,
    ]);
    process.stdout.write(`archive-inventory ${stdout.trim()}\n`);
    for (const entry of archive.entries) {
      entries.push({ logicalKey: entry.logicalKey, source: resolve(extractionRoot, "package", entry.path) });
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

function databaseJsonNumber(value) {
  if (value === undefined) return null;
  const number = Number(value);
  return Object.is(number, -0) ? 0 : number;
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
            technicalMetadata: record.technicalMetadata,
          },
          update: { technicalMetadata: record.technicalMetadata },
        });
        if (
          asset.objectKey !== record.objectKey ||
          asset.mediaKind !== mediaKindForMimeType(record.mimeType) ||
          asset.mimeType !== record.mimeType ||
          asset.byteSize !== BigInt(record.byteSize) ||
          !isDeepStrictEqual(asset.technicalMetadata, record.technicalMetadata)
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

async function verifyDatabaseManifest(manifest) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to verify managed assets");
  const pool = new Pool({ connectionString: databaseUrl });
  const database = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const links = await database.assetPurposeLink.findMany({
      include: { managedAsset: true },
      orderBy: { purpose: "asc" },
    });
    if (links.length !== Object.keys(manifest).length) {
      throw new Error(`Managed asset database/manifest purpose count drift: ${links.length} != ${Object.keys(manifest).length}`);
    }
    for (const link of links) {
      const record = manifest[link.purpose];
      if (!record) throw new Error(`Managed asset database purpose is absent from the manifest: ${link.purpose}`);
      const asset = link.managedAsset;
      if (
        asset.managedAssetId !== record.sha256 ||
        asset.sha256 !== record.sha256 ||
        asset.objectKey !== record.objectKey ||
        asset.mediaKind !== mediaKindForMimeType(record.mimeType) ||
        asset.mimeType !== record.mimeType ||
        asset.byteSize !== BigInt(record.byteSize) ||
        !isDeepStrictEqual(asset.technicalMetadata, record.technicalMetadata)
      ) {
        throw new Error(`Managed asset database/manifest record drift: ${link.purpose}`);
      }
    }
  } finally {
    await database.$disconnect();
    await pool.end();
  }
}

async function main() {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const location = spacesLocation();
  const corsOrigin = new URL(process.env.ASSET_CORS_ORIGIN ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").origin;
  const client = new S3Client({
    endpoint: location.endpoint,
    region: location.region,
    credentials: { accessKeyId: location.accessKeyId, secretAccessKey: location.secretAccessKey },
  });
  await mkdir(localAssetRoot, { recursive: true });
  await mkdir(workingRoot, { recursive: true });

  const logicalKeys = new Set();
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const importedManifest = {};
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
    const technical = await stripMetadata(entry.source, temporaryPath, extension);
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
      publicUrl: `${location.baseUrl}/${objectKey}`,
      sha256: hash,
    };
    if (!await verifyRemoteObject(client, remoteIdentity)) {
      if (verifyOnly) throw new Error(`Remote object is missing in verify-only mode: ${entry.logicalKey}`);
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
    if (verifyOnly) await verifyPublicDelivery({ ...remoteIdentity, corsOrigin });

    importedManifest[entry.logicalKey] = {
      byteSize: finalInfo.size,
      mimeType,
      objectKey,
      publicUrl: `${location.baseUrl}/${objectKey}`,
      sha256: hash,
      technicalMetadata: technical,
    };
    process.stdout.write(`${entry.logicalKey} ${hash} ${finalInfo.size}\n`);
  }

  Object.assign(manifest, importedManifest);
  if (verifyOnly) {
    const checkedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!isDeepStrictEqual(checkedManifest, manifest)) {
      throw new Error("Managed asset source/checked-manifest drift detected");
    }
    await verifyDatabaseManifest(checkedManifest);
  } else {
    await mkdir(dirname(manifestPath), { recursive: true });
    await persistManifest(importedManifest);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`manifest ${Object.keys(manifest).length} ${manifestPath}\n`);
}

await main();
