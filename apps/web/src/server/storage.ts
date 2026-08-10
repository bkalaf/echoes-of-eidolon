import { S3Client } from "@aws-sdk/client-s3";

import { getRuntimeEnv } from "./env";

let client: S3Client | undefined;

export function getObjectStorage(): { bucket: string; client: S3Client } {
  const env = getRuntimeEnv();
  client ??= new S3Client({
    region: env.AWS_REGION,
    ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {}),
  });

  return { bucket: env.AWS_S3_BUCKET, client };
}
