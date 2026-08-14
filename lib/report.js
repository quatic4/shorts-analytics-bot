function num(n) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(n || 0)));
}

function signed(n) {
  const value = Number(n || 0);
  return `${value >= 0 ? "+" : ""}${num(value)}`;
}

export function analyticsEmbed(data, label) {
  const daysText = label === "Today" ? "Latest complete day" : label;

  return {
    title: `📊 ${data.title} — Shorts Analytics`,
    description: `**${daysText}** • ${data.startDate} → ${data.endDate}`,
    thumbnail: data.thumbnail ? { url: data.thumbnail } : undefined,
    fields: [
      { name: "👀 Views", value: num(data.views), inline: true },
      { name: "👍 Likes", value: num(data.likes), inline: true },
      { name: "💬 Comments", value: num(data.comments), inline: true },
      { name: "👤 Current Subs", value: num(data.subscribers), inline: true },
      { name: "📈 Subs Gained", value: `+${num(data.subscribersGained)}`, inline: true },
      { name: "📉 Subs Lost", value: num(data.subscribersLost), inline: true },
      { name: "⚡ Net Subs", value: signed(data.netSubscribers), inline: true },
      { name: "⏱ Watch Time", value: `${num(data.watchMinutes / 60)} hrs`, inline: true }
    ],
    footer: {
      text: "Shorts Analytics • Data from YouTube Analytics"
    },
    timestamp: new Date().toISOString()
  };
}
