import { getOAuthClient, fetchChannelIdentity } from "../../lib/youtube.js";
import { parseState } from "../../lib/state.js";
import { getGuildConfig, setGuildConfig } from "../../lib/redis.js";

export default async function handler(req, res) {
  try {
    const code = req.query?.code;
    const state = req.query?.state;
    if (!code || !state) return res.status(400).send("Missing OAuth code or state.");

    const payload = parseState(state);
    const oauth = getOAuthClient();
    const { tokens } = await oauth.getToken(code);

    if (!tokens.refresh_token) {
      return res.status(400).send(
        "Google did not return a refresh token. Remove this app from your Google account permissions, then run /connect again."
      );
    }

    const identity = await fetchChannelIdentity(tokens);
    const existing = await getGuildConfig(payload.guildId) || {};

    await setGuildConfig(payload.guildId, {
      ...existing,
      youtubeTokens: tokens,
      youtubeChannel: identity,
      connectedBy: payload.userId,
      connectedAt: new Date().toISOString()
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(`
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Shorts Analytics Connected</title>
        </head>
        <body style="font-family:system-ui;background:#111;color:#fff;padding:32px;max-width:700px;margin:auto">
          <h1>✅ Connected</h1>
          <p><strong>${escapeHtml(identity.title)}</strong> is now connected to this Discord server.</p>
          <p>You can close this tab and run <strong>/analytics</strong> in Discord.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error(error);
    return res.status(400).send("Could not connect the YouTube channel. Please run /connect again.");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
