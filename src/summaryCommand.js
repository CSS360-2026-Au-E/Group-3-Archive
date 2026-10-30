const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { Events, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

function safeName(name) {
  return String(name || "unknown").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "unknown";
}

function dateStamp(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(input) {
  if (!input) return null;
  const lower = input.toLowerCase();
  if (lower === "today") return dateStamp(new Date());
  if (lower === "yesterday") {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return dateStamp(date);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;

  const [y, m, day] = input.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === day
    ? input
    : null;
}

function resolveChannel(message, arg) {
  if (!arg) return message.channel;
  const mention = arg.match(/^<#(\d+)>$/);
  if (mention) return message.guild.channels.cache.get(mention[1]) || null;
  const name = arg.replace(/^#/, "").toLowerCase();
  return message.guild.channels.cache.find((channel) =>
    channel.name?.toLowerCase() === name
  ) || null;
}

function splitText(text, limit = 1024) {
  const chunks = [];
  let remaining = text.trim();

  while (remaining.length) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    let splitAt = remaining.lastIndexOf("\n", limit);
    if (splitAt < limit / 2) splitAt = remaining.lastIndexOf(" ", limit);
    if (splitAt < limit / 2) splitAt = limit;

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return chunks;
}

async function summarizeConversation(transcript) {
  const response = await axios.post(process.env.OLLAMA_URL, {
    model: process.env.OLLAMA_MODEL,
    stream: false,
    messages: [
      {
        role: "system",
        content: `Summarize the Discord conversation log. Include the main topics, key decisions, important questions, and any action items. Do not invent details. Keep the summary concise and easy to read.`,
      },
      {
        role: "user",
        content: transcript.slice(0, 12000),
      },
    ],
    options: { temperature: 0.2 },
  }, { timeout: 60000 });

  return response.data?.message?.content?.trim() || "No summary could be generated.";
}

module.exports = function registerSummaryCommand(client, options = {}) {
  const {
    logDir = "logs",
    splitByChannel = true,
    prefix = "!",
    command = "summary",
    requiredPermission = PermissionFlagsBits.ManageMessages,
  } = options;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const parts = message.content.trim().split(/\s+/);
    if (parts[0].toLowerCase() !== prefix + command) return;

    const dateArg = parts[1];
    const channelArg = parts.slice(2).join(" ");

    try {
      if (requiredPermission && !message.member?.permissions.has(requiredPermission)) {
        return message.reply("You don't have permission to summarize logs.");
      }

      const date = parseDate(dateArg);
      if (!date) {
        return message.reply(`Usage: \`${prefix}${command} YYYY-MM-DD [#channel]\` (or \`today\` / \`yesterday\`)`);
      }

      const channel = resolveChannel(message, channelArg);
      if (!channel || !channel.permissionsFor(message.member)?.has(PermissionFlagsBits.ViewChannel)) {
        return message.reply("Channel not found.");
      }

      const filePath = splitByChannel
        ? path.join(logDir, safeName(message.guild.name), safeName(channel.name), `${date}.txt`)
        : path.join(logDir, `${date}.txt`);

      let transcript;
      try {
        transcript = await fs.promises.readFile(filePath, "utf8");
      } catch (error) {
        if (error.code === "ENOENT") {
          return message.reply(`No log for #${channel.name} on ${date}.`);
        }
        throw error;
      }

      transcript = transcript.trim();
      if (!transcript) return message.reply(`No messages in #${channel.name} on ${date}.`);

      await message.channel.sendTyping();
      const summary = await summarizeConversation(transcript);
      const chunks = splitText(summary).slice(0, 5);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Conversation Summary — #${channel.name}`)
        .setTimestamp();

      chunks.forEach((chunk, index) => {
        embed.addFields({ name: index === 0 ? `Summary — ${date}` : `Continued`, value: chunk });
      });

      return message.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Summary command failed:", error.message);
      return message.reply("Something went wrong summarizing that log.").catch(() => {});
    }
  });

  console.log(`Summary command on: ${prefix}${command} <date> [#channel]`);
};
