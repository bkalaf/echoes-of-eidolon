import { S3Client } from "@aws-sdk/client-s3";

import { getStorageEnv } from "./env";

let client: S3Client | undefined;

interface ObjectStorageLocation {
  bucket: string;
  endpoint?: string;
  region: string;
}

export function resolveObjectStorageLocation(input: {
  AWS_REGION?: string;
  AWS_S3_BUCKET?: string;
  DIGITALOCEAN_SPACES_DRIVE_URL?: string;
}): ObjectStorageLocation {
  if (input.AWS_REGION && input.AWS_S3_BUCKET) {
    return { region: input.AWS_REGION, bucket: input.AWS_S3_BUCKET };
  }

  if (!input.DIGITALOCEAN_SPACES_DRIVE_URL) {
    throw new Error("Object storage location is not configured");
  }
  const driveUrl = new URL(input.DIGITALOCEAN_SPACES_DRIVE_URL);
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
    throw new Error("DigitalOcean Spaces drive URL must be a bucket endpoint");
  }
  return {
    bucket,
    region,
    endpoint: `https://${region}.digitaloceanspaces.com`,
  };
}

export function getObjectStorage(): { bucket: string; client: S3Client } {
  const env = getStorageEnv();
  const location = resolveObjectStorageLocation(env);
  client ??= new S3Client({
    region: location.region,
    ...(location.endpoint ? { endpoint: location.endpoint } : {}),
    ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  return { bucket: location.bucket, client };
}
