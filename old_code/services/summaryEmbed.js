import { EmbedBuilder } from "discord.js";

// Builds the reply for /summarize. Returns something editReply() accepts.
export function buildSummaryReply({ summary, topics = [], messageCount, includedCount, rangeLabel }) {
  const title = rangeLabel
    ? `Summary of ${rangeLabel}`
    : `Summary of the last ${messageCount} message${messageCount === 1 ? "" : "s"}`;

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(summary?.trim() || "_No summary could be generated._")
    .addFields({
      name: "Main topics",
      value: topics.length ? topics.map((t) => `• ${t}`).join("\n") : "_None identified_",
    })
    .setTimestamp();

  const analyzed = includedCount ?? messageCount;
  const footer =
    analyzed < messageCount
      ? `Analyzed the most recent ${analyzed} of ${messageCount} messages`
      : `Analyzed ${messageCount} message${messageCount === 1 ? "" : "s"}`;
  embed.setFooter({ text: footer });

  return { embeds: [embed] };
}