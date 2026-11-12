import { EmbedBuilder, userMention } from "discord.js";

const CHANNEL_NAME = process.env.CHANNEL_NAME;

const event = {
  name: "memberAdd",
  async execute(member) {
    const channel = member.guild.channels.cache.find(
      (channel) => channel.name === CHANNEL_NAME
    );

    const welcomeMessage = await getWelcomeMessage(member.id);
    channel.send(welcomeMessage);
  },
};

const getWelcomeMessage = (userId) => {
  return {
    content: `Welcome  ${userMention(userId)}!\nPlease be aware that your messages within this server will be logged.`,
  };
};

export default event;
