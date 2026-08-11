import { Resend } from "resend";

import { getEmailEnv } from "./env";

let client: Resend | undefined;

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
