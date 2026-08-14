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
    console.error("OAuth callback failed:", {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      data: error?.response?.data
    });

    const apiReason =
      error?.response?.data?.error?.errors?.[0]?.reason ||
      error?.response?.data?.error_description ||
      error?.response?.data?.error ||
      error?.message ||
      "Unknown OAuth error";

    const friendly =
      apiReason === "youtubeSignupRequired"
        ? "The Google account you selected does not have a YouTube channel attached to it. Run /connect again and select the Google account that owns the YouTube channel."
        : apiReason === "authorizationRequired"
        ? "Google did not authorize YouTube access for this account. Run /connect again and approve the requested YouTube permissions."
        : `Could not connect the YouTube channel. Google returned: ${String(apiReason)}`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(400).send(`
      <!doctype html>
      <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
        <body style="font-family:system-ui;background:#111;color:#fff;padding:32px;max-width:700px;margin:auto">
          <h1>⚠️ Connection failed</h1>
          <p>${escapeHtml(friendly)}</p>
          <p>Go back to Discord and run <strong>/connect</strong> again.</p>
        </body>
      </html>
    `);
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
