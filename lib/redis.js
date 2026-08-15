import { Redis } from "@upstash/redis";
import { requireEnv } from "./env.js";
let redis;
export function getRedis(){ if(!redis) redis=new Redis({url:requireEnv("UPSTASH_REDIS_REST_URL"),token:requireEnv("UPSTASH_REDIS_REST_TOKEN")}); return redis; }
export async function getGuildConfig(guildId){ return getRedis().get(`guild:${guildId}`); }
export async function setGuildConfig(guildId, config){ await getRedis().set(`guild:${guildId}`,config); await getRedis().sadd("guilds:configured",guildId); }
export async function getConfiguredGuilds(){ return getRedis().smembers("guilds:configured"); }
export async function getPublicSnapshot(guildId,channelId){ return getRedis().get(`public-snapshot:${guildId}:${channelId}`); }
export async function setPublicSnapshot(guildId,channelId,snapshot){ return getRedis().set(`public-snapshot:${guildId}:${channelId}`,snapshot); }
export async function deletePublicSnapshot(guildId,channelId){ return getRedis().del(`public-snapshot:${guildId}:${channelId}`); }
export async function getDailySnapshot(guildId,channelId){ return getRedis().get(`daily-snapshot:${guildId}:${channelId}`); }
export async function setDailySnapshot(guildId,channelId,snapshot){ return getRedis().set(`daily-snapshot:${guildId}:${channelId}`,snapshot); }
