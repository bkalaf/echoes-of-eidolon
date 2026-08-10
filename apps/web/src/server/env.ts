import { z } from "zod";

const optionalNonempty = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

export const runtimeEnvSchema = z
  .object({
    DATABASE_URL: z.string().url().startsWith("postgresql://"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    AWS_REGION: z.string().min(1),
    AWS_S3_BUCKET: z.string().min(1),
    AWS_ACCESS_KEY_ID: optionalNonempty,
    AWS_SECRET_ACCESS_KEY: optionalNonempty,
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM_EMAIL: z.string().email(),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
  })
  .superRefine((value, context) => {
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

export function parseRuntimeEnv(source: NodeJS.ProcessEnv): RuntimeEnv {
  return runtimeEnvSchema.parse(source);
}

export function getRuntimeEnv(): RuntimeEnv {
  return parseRuntimeEnv(process.env);
}
