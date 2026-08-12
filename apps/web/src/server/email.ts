import { Resend } from "resend";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import process from "node:process";

import { getEmailEnv } from "./env";

let client: Resend | undefined;

export function authenticationCodeCapturePath(directory: string, recipient: string, purpose: string): string {
  const identity = createHash("sha256").update(`${recipient.toLowerCase()}\0${purpose}`).digest("hex");
  return resolve(directory, `${identity}.json`);
}

function captureAuthenticationCode(input: { recipient: string; code: string; purpose: string }): boolean {
  const directory = process.env.EIDOLON_E2E_AUTH_CODE_DIR;
  if (!directory) return false;
  if (process.env.NODE_ENV === "production") throw new Error("The E2E authentication-code sink is forbidden in production.");
  if (!isAbsolute(directory)) throw new Error("EIDOLON_E2E_AUTH_CODE_DIR must be absolute.");
  mkdirSync(directory, { mode: 0o700, recursive: true });
  writeFileSync(authenticationCodeCapturePath(directory, input.recipient, input.purpose), JSON.stringify(input), { mode: 0o600 });
  return true;
}

function getEmailClient(): Resend {
  client ??= new Resend(getEmailEnv().RESEND_API_KEY);
  return client;
}

export async function sendVerificationEmail(input: {
  recipient: string;
  url: string;
}): Promise<void> {
  const env = getEmailEnv();
  const { error } = await getEmailClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.recipient,
    subject: "Verify your Echoes of Eidolon email",
    text: `Verify your email address: ${input.url}`,
  });

  if (error) throw new Error(`Resend rejected the verification email: ${error.message}`);
}

export async function sendAuthenticationCode(input: {
  recipient: string;
  code: string;
  purpose: "sign-in" | "email-verification" | "forget-password" | "change-email" | "two-factor";
}): Promise<void> {
  if (captureAuthenticationCode(input)) return;
  const env = getEmailEnv();
  const { error } = await getEmailClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.recipient,
    subject: "Your Echoes of Eidolon verification code",
    text: `Your verification code is ${input.code}. Request type: ${input.purpose}.`,
  });

  if (error) throw new Error(`Resend rejected the verification code: ${error.message}`);
}

export async function sendBetaInvitation(input: {
  code: string;
  expiresAt: Date;
  recipient: string;
}): Promise<void> {
  const env = getEmailEnv();
  const { error } = await getEmailClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.recipient,
    subject: "Your Echoes of Eidolon beta invitation",
    text: `Your one-time invitation code is ${input.code}. It expires at ${input.expiresAt.toISOString()}.`,
  });

  if (error) throw new Error(`Resend rejected the beta invitation: ${error.message}`);
}

export async function sendCompanyContact(input: {
  message: string;
  recipient: string;
  replyEmail: string;
  topic: string;
}): Promise<string> {
  const env = getEmailEnv();
  const { data, error } = await getEmailClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.recipient,
    replyTo: input.replyEmail,
    subject: `Echoes company contact: ${input.topic}`,
    text: `Topic: ${input.topic}\nReply email: ${input.replyEmail}\n\n${input.message}`,
  });
  if (error || !data?.id) throw new Error(`Resend rejected the company contact: ${error?.message ?? "missing delivery reference"}`);
  return data.id;
}

export async function sendOrderStatusLink(input: { recipient: string; url: string }): Promise<void> {
  const env = getEmailEnv();
  const { error } = await getEmailClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.recipient,
    subject: "Your Echoes of Eidolon order status link",
    text: `Use this private link to view your order status: ${input.url}`,
  });
  if (error) throw new Error(`Resend rejected the order-status email: ${error.message}`);
}
