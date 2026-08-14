import crypto from "node:crypto";
import { requireEnv } from "./env.js";

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function makeState(payload) {
  const data = b64url(JSON.stringify({
    ...payload,
    exp: Date.now() + 15 * 60 * 1000
  }));
  const sig = crypto
    .createHmac("sha256", requireEnv("STATE_SECRET"))
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function parseState(state) {
  const [data, sig] = String(state || "").split(".");
  if (!data || !sig) throw new Error("Invalid state.");

  const expected = crypto
    .createHmac("sha256", requireEnv("STATE_SECRET"))
    .update(data)
    .digest("base64url");

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("Invalid state signature.");
  }

  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Date.now()) throw new Error("State expired.");
  return payload;
}
