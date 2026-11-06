import { SlashCommandBuilder } from "discord.js";
import parseTimeRange from "../helpers/parseTimeRange";
import { fetchMessages } from "../services/messages";
import { summarizeMessages } from "../services/ollama";
import { buildSummaryReply } from "../services/summaryEmbed";

const DEFAULT_COUNT = 20;
const MAX_COUNT = 100;

export const defaultDeps = { fetchMessages, summarizeMessages, buildSummaryReply };

const command = {
  data: new SlashCommandBuilder()
    .setName("summarize")
    .setDescription("Summarize recent messages in this channel")
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription(`How many recent messages to summarize (default ${DEFAULT_COUNT})`)
        .setMinValue(1)
        .setMaxValue(MAX_COUNT)
    )
    .addStringOption((option) =>
      option
        .setName("period")
        .setDescription('Time span instead of a count, e.g. "last hour", "1 day", "3h" (max 1 week)')
    ),

  // `deps` lets tests swap in fake versions of the services.
  async execute(interaction, deps = defaultDeps) {
    const periodText = interaction.options.getString("period");
    const count = interaction.options.getInteger("count") ?? DEFAULT_COUNT;

    // Check the period before deferring, so a typo gets a quick private reply.
    let range = null;
    if (periodText) {
      range = parseTimeRange(periodText);
      if (!range) {
        await interaction.reply({
          content: `I didn't understand "${periodText}". Try something like \`last hour\`, \`30 min\`, \`1 day\`, or \`3h\` (up to 1 week).`,
          ephemeral: true,
        });
        return;
      }
    }

    // Discord gives us 3 seconds to respond. Qwen takes longer than that,
    // so we defer (users see "ArchiveBot is thinking...") and have 15 minutes.
    await interaction.deferReply();

    try {
      const messages = await deps.fetchMessages(
        interaction.channel,
        range ? { sinceMs: range.ms } : { count }
      );

      if (messages.length === 0) {
        await interaction.editReply(
          range
            ? `There were no messages in ${range.label}.`
            : "There are no recent messages to summarize."
        );
        return;
      }

      const result = await deps.summarizeMessages(messages);

      // messageCount comes from our code, not the LLM.
      await interaction.editReply(
        deps.buildSummaryReply({
          ...result,
          messageCount: messages.length,
          rangeLabel: range?.label,
        })
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