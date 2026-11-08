import { ChannelType, PermissionFlagsBits, userMention } from "discord.js";

// Optional: a preferred welcome channel name from .env. If it's missing or not
// found, the bot falls back to the server's system channel, then to the first
// text channel it can post in.
const CHANNEL_NAME = process.env.CHANNEL_NAME;

// Can the bot actually see and post in this channel?
function canPost(channel, me) {
  return (
    channel?.type === ChannelType.GuildText &&
    channel.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
  );
}

// Pick where to greet: preferred name -> system channel -> first postable text channel
function findWelcomeChannel(guild) {
  const me = guild.members.me;

  if (CHANNEL_NAME) {
    const named = guild.channels.cache.find((c) => c.name === CHANNEL_NAME);
    if (canPost(named, me)) return named;
  }

  // The channel Discord itself uses for join messages (Server Settings -> Overview)
  if (canPost(guild.systemChannel, me)) return guild.systemChannel;

  // Otherwise the top-most text channel in the server's channel list
  return (
    guild.channels.cache
      .filter((c) => canPost(c, me))
      .sort((a, b) => a.rawPosition - b.rawPosition)
      .first() ?? null
  );
}

const getWelcomeMessage = (userId) => ({
  content: `Welcome ${userMention(userId)}!\nPlease be aware that your messages within this server will be logged.`,
  allowedMentions: { users: [userId] }, // ping only the new member, nobody else
});

const event = {
  name: "guildMemberAdd", // discord.js event name for a member joining
  async execute(member) {
    if (member.user.bot) return; // don't greet other bots

    const channel = findWelcomeChannel(member.guild);
    if (!channel) {
      console.warn(`No channel to greet ${member.user.tag} in ${member.guild.name}`);
      return;
    }

    try {
      await channel.send(getWelcomeMessage(member.id));
    } catch (err) {
      console.error(`Welcome message failed in ${member.guild.name} #${channel.name}:`, err.message);
    }
  },
};

export default event;