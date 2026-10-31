import { EmbedBuilder } from "discord.js";
import { analyzeConversation } from "../helpers";

const TESTING_CHANNEL_ID = "1564703878434263040";
const lastDeadlineSignatureByChannel = new Map();

function escapeDiscordMarkdown(value) {
  return value.replace(/([\\`*_~|\[\]()<>])/g, "\\$1");
}

export function formatDeadlineMessage(deadlines) {
  const lines = deadlines.map(
    (deadline) =>
      `- **${escapeDiscordMarkdown(deadline.task)}** — ${escapeDiscordMarkdown(
        deadline.dueDate
      )}`
  );

  return `**Detected deadlines**\n${lines.join("\n")}`;
}

const event = {
  name: "messageCreate",
  once: false,

  async execute(message, client) {
    // Ignore bot messages
    if (message.author.bot) return;
    console.log("New message received:", message.content);

    // Only analyze messages in the testing channel
    if (message.channel.id !== TESTING_CHANNEL_ID) return;

    try {
      const fetchedMessages = await message.channel.messages.fetch({
        limit: 20,
      });

      const messages = [...fetchedMessages.values()].reverse();

      const { topics, deadlines } = await analyzeConversation(messages);

      console.log("Identified topics:", topics);
      console.log("Identified deadlines:", deadlines);

      const signature = JSON.stringify(
        deadlines
          .map(({ task, dueDate }) => ({ task, dueDate }))
          .sort((a, b) =>
            `${a.task}\u0000${a.dueDate}`.localeCompare(`${b.task}\u0000${b.dueDate}`)
          )
      );
      const previousSignature = lastDeadlineSignatureByChannel.get(
        message.channel.id
      );
      lastDeadlineSignatureByChannel.set(message.channel.id, signature);
      const hasNewDeadlines =
        deadlines.length > 0 && signature !== previousSignature;

      const topicDescription = topics.length
        ? topics.map((topic, index) => `${index + 1}. **${topic}**`).join("\n")
        : "No meaningful topics were identified.";

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Conversation Analysis")
        .setDescription(
          hasNewDeadlines
            ? `${topicDescription}\n\n${formatDeadlineMessage(deadlines)}`
            : topicDescription
        )
        .setFooter({ text: "Analyzed the latest 20 messages" })
        .setTimestamp();

      await message.reply({
        embeds: [embed],
        allowedMentions: { parse: [], repliedUser: false },
      });
    } catch (error) {
      console.error("Conversation analysis failed:", error.message);
      await message
        .reply("I could not analyze the conversation right now.")
        .catch(() => {});
    }
  },
};

export default event;
