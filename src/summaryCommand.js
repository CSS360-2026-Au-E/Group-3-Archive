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

function cleanCell(value) {
  return String(value || "")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "—";
}

function splitRows(rows, limit = 900) {
  const groups = [];
  let current = [];
  let size = 0;

  for (const row of rows) {
    if (size + row.length > limit && current.length) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(row);
    size += row.length;
  }

  if (current.length) groups.push(current);
  return groups;
}

async function summarizeConversation(transcript) {
  const response = await axios.post(process.env.OLLAMA_URL, {
    model: process.env.OLLAMA_MODEL,
    stream: false,
    format: "json",
    messages: [
      {
        role: "system",
        content: `Analyze the Discord conversation log and organize what happened by topic.
Return ONLY valid JSON in this exact format:
{"topics":[{"topic":"Topic name","summary":"What was discussed","outcome":"Decision, action item, question, or result"}]}
Use 3 to 8 topics. Do not invent details. Keep each summary concise. Use an em dash in the outcome if no clear outcome exists.`,
      },
      {
        role: "user",
        content: transcript.slice(0, 12000),
      },
    ],
    options: { temperature: 0.2 },
  }, { timeout: 60000 });

  const content = response.data?.message?.content?.trim();
  if (!content) throw new Error("Ollama returned an empty summary.");

  const result = JSON.parse(content);
  if (!Array.isArray(result.topics)) throw new Error("Ollama returned an invalid topic table.");

  return result.topics
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      topic: cleanCell(item.topic),
      summary: cleanCell(item.summary),
      outcome: cleanCell(item.outcome),
    }))
    .slice(0, 8);
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
      const topics = await summarizeConversation(transcript);

      if (!topics.length) {
        return message.reply("No meaningful topics were found in this log.");
      }

      const header = "| Topic | Summary | Outcome |\n|---|---|---|";
      const rows = topics.map((item) =>
        `| ${item.topic} | ${item.summary} | ${item.outcome} |`
      );
      const rowGroups = splitRows(rows.map((row) => `${row}\n`));
      const embeds = [];

      for (let index = 0; index < Math.min(rowGroups.length, 10); index += 1) {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(index === 0
            ? `Conversation Summary — #${channel.name}`
            : `Conversation Summary — Continued (${index + 1})`)
          .setDescription(`\`\`\`text\n${header}\n${rowGroups[index].join("")}\n\`\`\``)
          .setTimestamp();

        if (index === 0) embed.setFooter({ text: `Log date: ${date}` });
        embeds.push(embed);
      }

      return message.reply({ embeds });
    } catch (error) {
      console.error("Summary command failed:", error.message);
      return message.reply("Something went wrong summarizing that log.").catch(() => {});
    }
  });

  console.log(`Summary command on: ${prefix}${command} <date> [#channel]`);
};
