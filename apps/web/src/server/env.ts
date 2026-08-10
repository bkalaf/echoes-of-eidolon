import { z } from "zod";

const optionalNonempty = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const runtimeEnvObject = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  AWS_REGION: optionalNonempty,
  AWS_S3_BUCKET: optionalNonempty,
  AWS_ACCESS_KEY_ID: optionalNonempty,
  AWS_SECRET_ACCESS_KEY: optionalNonempty,
  DIGITALOCEAN_SPACES_DRIVE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  DIGITALOCEAN_SPACES_KEY_NAME: optionalNonempty,
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

export const runtimeEnvSchema = runtimeEnvObject.superRefine((value, context) => {
  const hasAccessKey = value.AWS_ACCESS_KEY_ID !== undefined;
  const hasSecretKey = value.AWS_SECRET_ACCESS_KEY !== undefined;
  if (hasAccessKey !== hasSecretKey) {
    context.addIssue({
      code: "custom",
      path: [hasAccessKey ? "AWS_SECRET_ACCESS_KEY" : "AWS_ACCESS_KEY_ID"],
      message: "AWS credentials must be supplied as a pair",
    });
  }
});

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

const databaseEnvSchema = runtimeEnvObject.pick({ DATABASE_URL: true });
const authEnvSchema = runtimeEnvObject.pick({
  DATABASE_URL: true,
  BETTER_AUTH_SECRET: true,
  BETTER_AUTH_URL: true,
  RESEND_API_KEY: true,
  RESEND_FROM_EMAIL: true,
});
const storageEnvSchema = runtimeEnvObject.pick({
  AWS_REGION: true,
  AWS_S3_BUCKET: true,
  AWS_ACCESS_KEY_ID: true,
  AWS_SECRET_ACCESS_KEY: true,
  DIGITALOCEAN_SPACES_DRIVE_URL: true,
  DIGITALOCEAN_SPACES_KEY_NAME: true,
}).superRefine((value, context) => {
  const hasAccessKey = value.AWS_ACCESS_KEY_ID !== undefined;
  const hasSecretKey = value.AWS_SECRET_ACCESS_KEY !== undefined;
  if (hasAccessKey !== hasSecretKey) {
    context.addIssue({
      code: "custom",
      path: [hasAccessKey ? "AWS_SECRET_ACCESS_KEY" : "AWS_ACCESS_KEY_ID"],
      message: "AWS credentials must be supplied as a pair",
    });
  }
  if (value.DIGITALOCEAN_SPACES_DRIVE_URL && !hasAccessKey && !hasSecretKey) {
    context.addIssue({
      code: "custom",
      path: ["AWS_ACCESS_KEY_ID"],
      message: "DigitalOcean Spaces credentials are required",
    });
  }
  const hasAwsLocation = Boolean(value.AWS_REGION && value.AWS_S3_BUCKET);
  if (!hasAwsLocation && !value.DIGITALOCEAN_SPACES_DRIVE_URL) {
    context.addIssue({
      code: "custom",
      path: ["DIGITALOCEAN_SPACES_DRIVE_URL"],
      message: "Configure AWS_REGION/AWS_S3_BUCKET or a DigitalOcean Spaces drive URL",
    });
  }
});
const emailEnvSchema = runtimeEnvObject.pick({
  RESEND_API_KEY: true,
  RESEND_FROM_EMAIL: true,
});
const paymentsEnvSchema = runtimeEnvObject.pick({
  STRIPE_SECRET_KEY: true,
  STRIPE_WEBHOOK_SECRET: true,
});
const atlasEnvSchema = z.object({ ATLAS_RELEASE_ROOT: z.string().min(1) });

export function parseRuntimeEnv(source: NodeJS.ProcessEnv): RuntimeEnv {
  return runtimeEnvSchema.parse(source);
}

export function getRuntimeEnv(): RuntimeEnv {
  return parseRuntimeEnv(process.env);
}

export const getDatabaseEnv = () => databaseEnvSchema.parse(process.env);
export const getAuthEnv = () => authEnvSchema.parse(process.env);
export const getStorageEnv = () => storageEnvSchema.parse(process.env);
export const getEmailEnv = () => emailEnvSchema.parse(process.env);
export const getPaymentsEnv = () => paymentsEnvSchema.parse(process.env);
export const getAtlasEnv = () => atlasEnvSchema.parse(process.env);
