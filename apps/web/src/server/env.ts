import { z } from "zod";

const runtimeEnvObject = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  DIGITALOCEAN_SPACES_DRIVE_URL: z.string().url(),
  DIGITALOCEAN_SPACES_KEY_NAME: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().email(),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

export const runtimeEnvSchema = runtimeEnvObject;

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
  AWS_ACCESS_KEY_ID: true,
  AWS_SECRET_ACCESS_KEY: true,
  DIGITALOCEAN_SPACES_DRIVE_URL: true,
  DIGITALOCEAN_SPACES_KEY_NAME: true,
});
const emailEnvSchema = runtimeEnvObject.pick({
  RESEND_API_KEY: true,
  RESEND_FROM_EMAIL: true,
});
const paymentsEnvSchema = runtimeEnvObject.pick({
  STRIPE_SECRET_KEY: true,
  STRIPE_WEBHOOK_SECRET: true,
});
const atlasEnvSchema = z.object({ EIDOLON_ATLAS_RELEASE_ROOT: z.string().min(1) });

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
