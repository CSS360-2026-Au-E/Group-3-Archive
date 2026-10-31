import { EmbedBuilder } from "discord.js";
import { identifyTopics } from "../helpers";

const TESTING_CHANNEL_ID = "1564703878434263040";

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

      const topics = await identifyTopics(messages);

      console.log("Identified topics:", topics);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle("Conversation Topics")
        .setDescription(
          topics.length
            ? topics.map((topic, index) => `${index + 1}. **${topic}**`).join("\n")
            : "No meaningful topics were identified."
        )
        .setFooter({ text: "Analyzed the latest 20 messages" })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Topic identification failed:", error.message);
      await message.reply("I could not identify the conversation topics right now.").catch(() => {});
    }
  },
};

export default event;