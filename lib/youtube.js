import { google } from "googleapis";
import { requireEnv } from "./env.js";

export function getOAuthClient() {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI")
  );
}

export function getAuthUrl(state) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/yt-analytics.readonly",
      "https://www.googleapis.com/auth/youtube.readonly"
    ],
    state
  });
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function rangeForDays(days) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

export async function fetchChannelIdentity(tokens) {
  const auth = getOAuthClient();
  auth.setCredentials(tokens);

  const youtube = google.youtube({ version: "v3", auth });
  const result = await youtube.channels.list({
    part: ["snippet", "statistics"],
    mine: true
  });

  const channel = result.data.items?.[0];
  if (!channel) throw new Error("No YouTube channel found for this account.");

  return {
    channelId: channel.id,
    title: channel.snippet?.title || "YouTube Channel",
    thumbnail: channel.snippet?.thumbnails?.default?.url || null,
    subscribers: Number(channel.statistics?.subscriberCount || 0)
  };
}

async function queryAnalytics(tokens, days) {
  const auth = getOAuthClient();
  auth.setCredentials(tokens);
  const youtubeAnalytics = google.youtubeAnalytics({ version: "v2", auth });
  const { startDate, endDate } = rangeForDays(days);

  const report = await youtubeAnalytics.reports.query({
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: "views,likes,comments,estimatedMinutesWatched,subscribersGained,subscribersLost",
    dimensions: "creatorContentType",
    filters: "creatorContentType==SHORTS"
  });

  const headers = report.data.columnHeaders || [];
  const row = report.data.rows?.[0] || [];
  const values = Object.fromEntries(headers.map((h, i) => [h.name, row[i] ?? 0]));

  return {
    startDate,
    endDate,
    views: Number(values.views || 0),
    likes: Number(values.likes || 0),
    comments: Number(values.comments || 0),
    watchMinutes: Number(values.estimatedMinutesWatched || 0),
    subscribersGained: Number(values.subscribersGained || 0),
    subscribersLost: Number(values.subscribersLost || 0)
  };
}

export async function getShortsAnalytics(tokens, days) {
  const [identity, analytics] = await Promise.all([
    fetchChannelIdentity(tokens),
    queryAnalytics(tokens, days)
  ]);

  return {
    ...identity,
    ...analytics,
    netSubscribers: analytics.subscribersGained - analytics.subscribersLost
  };
}
