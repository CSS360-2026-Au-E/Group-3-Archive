import { SlashCommandBuilder } from "discord.js";

const DEFAULT_COUNT = 20;
const MAX_COUNT = 100; // Discord only lets a bot fetch 100 messages per request

/* ------------------------------------------------------------------
   PLACEHOLDERS — swap these for teammates' real functions as their
   PRs are merged. Keep the same names/shapes so nothing else changes.
   ------------------------------------------------------------------ */

// TODO (E1): replace with  import { fetchRecentMessages } from "../services/messages";
async function fetchRecentMessages(channel, count) {
  const sample = [
    { content: "When is the CSS 360 deadline?", author: "ELS", timestamp: new Date() },
    { content: "Next Thursday. We should split up the bot work.", author: "Vic", timestamp: new Date() },
    { content: "I'll take the /summarize command.", author: "Noah", timestamp: new Date() },
  ];
  return sample.slice(0, count);
}

// TODO (E2 + V): replace with  import { summarizeMessages } from "../services/ollama";
// Agreed shape: { summary: string, topics: string[] }
async function summarizeMessages(messages) {
  return {
    summary: "(Placeholder) The group talked about the project deadline and split up tasks.",
    topics: ["Project planning", "Deadlines"],
  };
}

// TODO (S): replace with  import { buildSummaryEmbed } from "../services/summaryEmbed";
// Must return something editReply() accepts, e.g. { embeds: [embed] }
function buildSummaryReply({ summary, topics, messageCount }) {
  return {
    content:
      `**Summary of the last ${messageCount} messages**\n${summary}\n\n` +
      `**Main topics:** ${topics.join(", ")}`,
  };
}

export const defaultDeps = { fetchRecentMessages, summarizeMessages, buildSummaryReply };

/* ------------------------------------------------------------------
   THE COMMAND (Noah's story)
   ------------------------------------------------------------------ */

const command = {
  data: new SlashCommandBuilder()
    .setName("summarize")
    .setDescription("Summarize recent messages in this channel")
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription(`How many messages to summarize (default ${DEFAULT_COUNT})`)
        .setMinValue(1)
        .setMaxValue(MAX_COUNT)
    ),

  // `deps` lets tests pass in fake versions of the teammates' functions.
  async execute(interaction, deps = defaultDeps) {
    const count = interaction.options.getInteger("count") ?? DEFAULT_COUNT;

    // Discord gives us 3 seconds to respond. Qwen takes longer than that,
    // so we "defer" right away (users see "ArchiveBot is thinking...")
    // and then have 15 minutes to edit in the real answer.
    await interaction.deferReply();

    try {
      const messages = await deps.fetchRecentMessages(interaction.channel, count);

      if (messages.length === 0) {
        await interaction.editReply("There are no recent messages to summarize.");
        return;
      }

      const result = await deps.summarizeMessages(messages);

      // messageCount comes from our code, not the LLM.
      await interaction.editReply(
        deps.buildSummaryReply({ ...result, messageCount: messages.length })
      );
    } catch (error) {
      console.error("[/summarize] failed:", error);
      await interaction.editReply(
        "Sorry, I couldn't summarize this channel right now. Please try again in a moment."
      );
    }
  },
};

export default command;