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
  const c = getOAuthClient();
  return c.generateAuthUrl({
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: true,
    scope: [
      "https://www.googleapis.com/auth/yt-analytics.readonly",
      "https://www.googleapis.com/auth/youtube.readonly"
    ],
    state
  });
}

function isoDate(d){return d.toISOString().slice(0,10)}
function rangeForDays(days){
  const e=new Date();
  e.setUTCDate(e.getUTCDate()-1);
  const s=new Date(e);
  s.setUTCDate(s.getUTCDate()-(days-1));
  return{startDate:isoDate(s),endDate:isoDate(e)}
}

export async function fetchChannelIdentity(tokens) {
  const auth = getOAuthClient();
  auth.setCredentials(tokens);

  const yt = google.youtube({ version: "v3", auth });
  const r = await yt.channels.list({
    part: ["snippet", "statistics"],
    mine: true
  });

  const c = r.data.items?.[0];
  if (!c) throw new Error("No YouTube channel found for this Google account.");

  return {
    channelId: c.id,
    title: c.snippet?.title || "YouTube Channel",
    handle: c.snippet?.customUrl || null,
    thumbnail: c.snippet?.thumbnails?.default?.url || null,
    subscribers: Number(c.statistics?.subscriberCount || 0)
  };
}

async function queryAnalytics(tokens, days) {
  const auth = getOAuthClient();
  auth.setCredentials(tokens);

  const ya = google.youtubeAnalytics({ version: "v2", auth });
  const { startDate, endDate } = rangeForDays(days);

  // creatorContentType is supported as a dimension for this channel report,
  // but not as a filter. Query all content types, then select the SHORTS row.
  const r = await ya.reports.query({
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: "views,likes,comments,estimatedMinutesWatched,subscribersGained,subscribersLost",
    dimensions: "creatorContentType"
  });

  const headers = r.data.columnHeaders || [];
  const rows = r.data.rows || [];
  const names = headers.map(h => h.name);

  const typeIndex = names.indexOf("creatorContentType");
  const shortsRow = rows.find(row => row[typeIndex] === "SHORTS");

  const row = shortsRow || [];
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

export async function getShortsAnalytics(tokens,days){
  const [id,a]=await Promise.all([
    fetchChannelIdentity(tokens),
    queryAnalytics(tokens,days)
  ]);
  return{...id,...a,netSubscribers:a.subscribersGained-a.subscribersLost}
}

function cleanHandle(h){
  let v=String(h||"").trim();
  if(v.includes("youtube.com/@"))v=v.split("youtube.com/@")[1].split(/[/?#]/)[0];
  v=v.replace(/^@/,"");
  if(!v)throw new Error("Enter a valid YouTube @handle.");
  return v
}

function publicYT(){
  return google.youtube({version:"v3",auth:requireEnv("YOUTUBE_API_KEY")})
}

function map(c){
  const s=c.statistics||{};
  return{
    channelId:c.id,
    title:c.snippet?.title||"YouTube Channel",
    handle:c.snippet?.customUrl||null,
    thumbnail:c.snippet?.thumbnails?.high?.url||c.snippet?.thumbnails?.default?.url||null,
    subscribers:Number(s.subscriberCount||0),
    views:Number(s.viewCount||0),
    videos:Number(s.videoCount||0),
    fetchedAt:new Date().toISOString()
  }
}

export async function resolvePublicChannel(handle){
  const h=cleanHandle(handle),yt=publicYT();
  const r=await yt.channels.list({part:["snippet","statistics"],forHandle:h});
  const c=r.data.items?.[0];
  if(!c)throw new Error(`Could not find YouTube channel @${h}.`);
  return{...map(c),inputHandle:`@${h}`}
}

export async function fetchPublicChannelById(id){
  const yt=publicYT();
  const r=await yt.channels.list({part:["snippet","statistics"],id:[id]});
  const c=r.data.items?.[0];
  if(!c)throw new Error("Tracked YouTube channel not found.");
  return map(c)
}
