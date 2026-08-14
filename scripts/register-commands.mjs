const appId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;

if (!appId || !token) {
  console.error("Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN first.");
  process.exit(1);
}

const commands = [
  {
    name: "connect",
    description: "Connect a YouTube channel to this server"
  },
  {
    name: "setup",
    description: "Choose the channel for automatic daily Shorts reports",
    options: [
      {
        type: 7,
        name: "channel",
        description: "Discord channel for daily analytics",
        required: true,
        channel_types: [0, 5]
      }
    ]
  },
  {
    name: "analytics",
    description: "Show the latest Shorts analytics"
  },
  {
    name: "today",
    description: "Show the latest complete day of Shorts analytics"
  },
  {
    name: "week",
    description: "Show the last 7 complete days of Shorts analytics"
  }
];

const response = await fetch(
  `https://discord.com/api/v10/applications/${appId}/commands`,
  {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(commands)
  }
);

if (!response.ok) {
  console.error(await response.text());
  process.exit(1);
}

console.log("✅ Discord slash commands registered.");
console.log(await response.json());
