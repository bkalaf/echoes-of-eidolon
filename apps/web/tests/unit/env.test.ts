import { describe, expect, it } from "vitest";

import { parseRuntimeEnv } from "../../src/server/env";
import { resolveObjectStorageLocation } from "../../src/server/storage";

const validEnvironment = {
  DATABASE_URL: "postgresql://localhost/echoes",
  BETTER_AUTH_SECRET: "a-secure-development-secret-of-32-chars",
  BETTER_AUTH_URL: "http://localhost:3000",
  AWS_REGION: "us-west-2",
  AWS_S3_BUCKET: "echoes-assets",
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "echoes@example.com",
  STRIPE_SECRET_KEY: "sk_test_value",
  STRIPE_WEBHOOK_SECRET: "whsec_value",
};

describe("runtime environment", () => {
  it("accepts the service contract without static AWS credentials", () => {
    expect(parseRuntimeEnv(validEnvironment)).toMatchObject(validEnvironment);
  });

  it("rejects incomplete AWS credential pairs", () => {
    expect(() =>
      parseRuntimeEnv({ ...validEnvironment, AWS_ACCESS_KEY_ID: "access" }),
    ).toThrow("AWS credentials must be supplied as a pair");
  });

  it("rejects missing service configuration", () => {
    expect(() => parseRuntimeEnv({})).toThrow();
  });

  it("derives the S3-compatible location from a Spaces bucket endpoint", () => {
    expect(
      resolveObjectStorageLocation({
        DIGITALOCEAN_SPACES_DRIVE_URL: "https://echoes.nyc3.digitaloceanspaces.com/",
      }),
    ).toEqual({
      bucket: "echoes",
      endpoint: "https://nyc3.digitaloceanspaces.com",
      region: "nyc3",
    });
  });

  it("rejects a Spaces URL that is not the bucket endpoint", () => {
    expect(() =>
      resolveObjectStorageLocation({
        DIGITALOCEAN_SPACES_DRIVE_URL: "https://echoes.nyc3.digitaloceanspaces.com/assets/",
      }),
    ).toThrow("must be a bucket endpoint");
  });
});
