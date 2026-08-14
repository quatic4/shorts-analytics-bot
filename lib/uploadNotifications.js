import { requireEnv } from "./env.js";
import { getRedis, getConfiguredGuilds, getGuildConfig } from "./redis.js";
import { sendChannelMessage } from "./discord.js";

const HUB_URL = "https://pubsubhubbub.appspot.com/subscribe";

export function uploadCallbackUrl() {
  const origin = new URL(requireEnv("GOOGLE_REDIRECT_URI")).origin;
  return `${origin}/api/youtube/uploads`;
}

export async function subscribeChannel(channelId) {
  if (!channelId) return false;

  const body = new URLSearchParams({
    "hub.callback": uploadCallbackUrl(),
    "hub.mode": "subscribe",
    "hub.topic": `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`,
    "hub.verify": "async",
    "hub.lease_seconds": "864000"
  });

  const response = await fetch(HUB_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok && response.status !== 202 && response.status !== 204) {
    const text = await response.text();
    throw new Error(`YouTube upload subscription failed (${response.status}): ${text}`);
  }

  return true;
}

export function channelIdsForConfig(config = {}) {
  const ids = new Set();

  if (config.youtubeChannel?.channelId) ids.add(config.youtubeChannel.channelId);

  const publicChannels = Array.isArray(config.publicChannels) ? config.publicChannels : [];
  for (const channel of publicChannels) {
    if (channel?.channelId) ids.add(channel.channelId);
  }

  return [...ids];
}

export async function subscribeGuildChannels(config = {}) {
  const ids = channelIdsForConfig(config);
  for (const channelId of ids) {
    await subscribeChannel(channelId);
  }
  return ids.length;
}

export async function renewAllUploadSubscriptions() {
  const guilds = await getConfiguredGuilds();
  const ids = new Set();

  for (const guildId of guilds) {
    const config = await getGuildConfig(guildId);
    if (!config?.uploadNotifyChannelId) continue;
    for (const id of channelIdsForConfig(config)) ids.add(id);
  }

  for (const id of ids) {
    try {
      await subscribeChannel(id);
    } catch (error) {
      console.error("Upload subscription renewal failed:", id, error);
    }
  }

  return ids.size;
}

function getTag(xml, tag) {
  const escaped = tag.replace(":", "\\:");
  const match = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match?.[1]?.trim() || "";
}

function decodeXml(value = "") {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

export function parseUploadFeed(xml) {
  const entries = [...String(xml).matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map(m => m[0]);

  return entries.map(entry => ({
    videoId: decodeXml(getTag(entry, "yt:videoId")),
    channelId: decodeXml(getTag(entry, "yt:channelId")),
    title: decodeXml(getTag(entry, "title")),
    published: decodeXml(getTag(entry, "published")),
    author: decodeXml(getTag(entry, "name"))
  })).filter(x => x.videoId && x.channelId);
}

export async function notifyUpload(event) {
  const guilds = await getConfiguredGuilds();
  let sent = 0;

  for (const guildId of guilds) {
    const config = await getGuildConfig(guildId);
    if (!config?.uploadNotifyChannelId) continue;

    const tracked = channelIdsForConfig(config);
    if (!tracked.includes(event.channelId)) continue;

    const seenKey = `upload-seen:${guildId}:${event.videoId}`;
    const claimed = await getRedis().set(seenKey, "1", { nx: true, ex: 60 * 60 * 24 * 30 });
    if (!claimed) continue;

    const videoUrl = `https://www.youtube.com/watch?v=${event.videoId}`;

    await sendChannelMessage(config.uploadNotifyChannelId, {
      content: `@everyone 📢 **${event.author || "A tracked channel"} just uploaded!**`,
      embeds: [{
        title: event.title || "New YouTube upload",
        url: videoUrl,
        description: event.author ? `New upload from **${event.author}**` : "New YouTube upload",
        image: { url: `https://i.ytimg.com/vi/${event.videoId}/hqdefault.jpg` },
        fields: event.published ? [{ name: "Published", value: `<t:${Math.floor(new Date(event.published).getTime()/1000)}:R>`, inline: true }] : [],
        footer: { text: "YouTube Upload Notifier" },
        timestamp: event.published || new Date().toISOString()
      }],
      allowed_mentions: { parse: ["everyone"] }
    });

    sent++;
  }

  return sent;
}
