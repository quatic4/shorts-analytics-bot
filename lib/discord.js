import nacl from "tweetnacl";
import { requireEnv } from "./env.js";

const API = "https://discord.com/api/v10";

export function verifyDiscordRequest(req, rawBody) {
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];
  if (!signature || !timestamp) return false;

  const publicKey = requireEnv("DISCORD_PUBLIC_KEY");
  return nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, "hex"),
    Buffer.from(publicKey, "hex")
  );
}

export async function discordApi(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bot ${requireEnv("DISCORD_BOT_TOKEN")}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord API ${response.status}: ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function sendChannelMessage(channelId, payload) {
  return discordApi(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function ephemeral(content, extra = {}) {
  return {
    type: 4,
    data: {
      content,
      flags: 64,
      allowed_mentions: { parse: [] },
      ...extra
    }
  };
}
