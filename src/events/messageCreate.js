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
    } catch (error) {
      console.error("Topic identification failed:", error.message);
    }
  },
};

export default event;