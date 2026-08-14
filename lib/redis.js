import { Redis } from "@upstash/redis";
import { requireEnv } from "./env.js";

let redis;

export function getRedis() {
  if (!redis) {
    redis = new Redis({
      url: requireEnv("UPSTASH_REDIS_REST_URL"),
      token: requireEnv("UPSTASH_REDIS_REST_TOKEN")
    });
  }
  return redis;
}

export async function getGuildConfig(guildId) {
  return getRedis().get(`guild:${guildId}`);
}

export async function setGuildConfig(guildId, config) {
  await getRedis().set(`guild:${guildId}`, config);
  await getRedis().sadd("guilds:configured", guildId);
}

export async function getConfiguredGuilds() {
  return getRedis().smembers("guilds:configured");
}
