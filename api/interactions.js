import { verifyDiscordRequest, ephemeral } from "../lib/discord.js";
import { getGuildConfig, setGuildConfig } from "../lib/redis.js";
import { getAuthUrl } from "../lib/youtube.js";
import { makeState } from "../lib/state.js";
import { getShortsAnalytics } from "../lib/youtube.js";
import { analyticsEmbed } from "../lib/report.js";

export const config = {
  api: { bodyParser: false }
};

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function option(interaction, name) {
  return interaction.data?.options?.find((x) => x.name === name)?.value;
}

function hasManageGuild(interaction) {
  const raw = interaction.member?.permissions;
  if (!raw) return false;
  const perms = BigInt(raw);
  return (perms & BigInt(0x20)) === BigInt(0x20);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const raw = await readRaw(req);
  if (!verifyDiscordRequest(req, raw)) return res.status(401).send("Invalid signature");

  const interaction = JSON.parse(raw);

  if (interaction.type === 1) {
    return res.status(200).json({ type: 1 });
  }

  if (interaction.type !== 2) {
    return res.status(200).json(ephemeral("Unsupported interaction."));
  }

  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const command = interaction.data?.name;

  if (!guildId) {
    return res.status(200).json(ephemeral("Use this command inside a Discord server."));
  }

  try {
    if (command === "connect") {
      if (!hasManageGuild(interaction)) {
        return res.status(200).json(ephemeral("You need **Manage Server** permission to connect a YouTube channel."));
      }

      const state = makeState({ guildId, userId });
      const url = getAuthUrl(state);
      return res.status(200).json(ephemeral(
        `Connect the YouTube channel that should power this server's Shorts analytics:\n${url}\n\nThis link expires in 15 minutes.`
      ));
    }

    if (command === "setup") {
      if (!hasManageGuild(interaction)) {
        return res.status(200).json(ephemeral("You need **Manage Server** permission to change bot setup."));
      }

      const channelId = String(option(interaction, "channel") || interaction.channel_id);
      const existing = await getGuildConfig(guildId) || {};
      await setGuildConfig(guildId, {
        ...existing,
        reportChannelId: channelId,
        updatedAt: new Date().toISOString()
      });

      return res.status(200).json(ephemeral(
        `✅ Daily Shorts reports will be posted in <#${channelId}>.\n\nNext: run **/connect** to authorize the YouTube channel.`
      ));
    }

    if (["analytics", "today", "week"].includes(command)) {
      const config = await getGuildConfig(guildId);
      if (!config?.youtubeTokens) {
        return res.status(200).json(ephemeral("No YouTube channel is connected yet. A server manager can run **/connect**."));
      }

      const days = command === "week" ? 7 : 1;
      const label = command === "week" ? "Last 7 complete days" : "Today";
      const data = await getShortsAnalytics(config.youtubeTokens, days);

      return res.status(200).json({
        type: 4,
        data: {
          embeds: [analyticsEmbed(data, label)],
          allowed_mentions: { parse: [] }
        }
      });
    }

    return res.status(200).json(ephemeral("Unknown command."));
  } catch (error) {
    console.error(error);
    return res.status(200).json(ephemeral(
      "Something went wrong while loading the analytics. Check the bot configuration and try again."
    ));
  }
}
