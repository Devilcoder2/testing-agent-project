import nodemailer from "nodemailer";

function appUrl(path: string) {
  return new URL(path, process.env.SENTINEL_APP_URL ?? "http://localhost:3001").toString();
}

export async function sendAccountLink(input: { to: string; kind: "invite" | "reset"; token: string; organizationName?: string }) {
  const path = input.kind === "invite" ? `/invite?token=${input.token}` : `/reset-password?token=${input.token}`;
  const subject = input.kind === "invite" ? `Sentinel invitation${input.organizationName ? `: ${input.organizationName}` : ""}` : "Sentinel password reset";
  const action = input.kind === "invite" ? "Set your password and join the workspace" : "Choose a new password";
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST ?? "mailpit", port: Number(process.env.SMTP_PORT ?? "1025"), secure: false });
  await transport.sendMail({ from: process.env.EMAIL_FROM ?? "Sentinel <noreply@sentinel.local>", to: input.to, subject, text: `${action}: ${appUrl(path)}\n\nThis one-time link expires in 24 hours.` });
}
