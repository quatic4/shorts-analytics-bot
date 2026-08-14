import { getConfiguredGuilds, getGuildConfig } from "../../lib/redis.js";
import { getShortsAnalytics } from "../../lib/youtube.js";
import { analyticsEmbed } from "../../lib/report.js";
import { sendChannelMessage } from "../../lib/discord.js";

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false });
  }

  const guilds = await getConfiguredGuilds();
  const results = [];

  for (const guildId of guilds) {
    try {
      const config = await getGuildConfig(guildId);
      if (!config?.reportChannelId || !config?.youtubeTokens) continue;

      const data = await getShortsAnalytics(config.youtubeTokens, 1);
      await sendChannelMessage(config.reportChannelId, {
        embeds: [analyticsEmbed(data, "Daily Shorts Report")],
        allowed_mentions: { parse: [] }
      });

      results.push({ guildId, ok: true });
    } catch (error) {
      console.error(`Daily report failed for ${guildId}`, error);
      results.push({ guildId, ok: false });
    }
  }

  return res.status(200).json({ ok: true, processed: results.length, results });
}
