import { Resend } from "resend";

import { getRuntimeEnv } from "./env";

let client: Resend | undefined;

function getEmailClient(): Resend {
  client ??= new Resend(getRuntimeEnv().RESEND_API_KEY);
  return client;
}

export async function sendVerificationEmail(input: {
  recipient: string;
  url: string;
}): Promise<void> {
  const env = getRuntimeEnv();
  const { error } = await getEmailClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.recipient,
    subject: "Verify your Echoes of Eidolon email",
    text: `Verify your email address: ${input.url}`,
  });

  if (error) throw new Error(`Resend rejected the verification email: ${error.message}`);
}
