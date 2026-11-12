// Command that prints a saved log file for a given date and channel.
//
//   !log 2026-10-29              -> log for the channel you typed it in
//   !log 2026-10-29 #general     -> log for #general (mention or plain name)
//   !log today #general          -> "today" and "yesterday" also work
//
// Logs are returned as Discord embeds. Long logs are split across multiple embeds.
//
// Usage (in bot.js) - pass the SAME options to both so they look in the same place:
//   const registerMessageLogger = require("./messageLogger");
//   const registerLogCommand = require("./logCommand");
//   const LOG_OPTIONS = { logDir: path.join(__dirname, "logs"), splitByChannel: true };
//   registerMessageLogger(client, LOG_OPTIONS);
//   registerLogCommand(client, LOG_OPTIONS);

const fs = require("fs");
const path = require("path");
const { Events, EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const EMBED_TEXT_LIMIT = 3800;
const MAX_EMBEDS = 10;

// Must match safeName() in messageLogger.js so folder names line up
function safeName(name) {
  return String(name || "unknown").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "unknown";
}

// YYYY-MM-DD in local time (same as messageLogger.js)
function dateStamp(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Turn the user's date argument into YYYY-MM-DD, or null if it's not valid
function parseDate(input) {
  if (!input) return null;
  const lower = input.toLowerCase();
  if (lower === "today") return dateStamp(new Date());
  if (lower === "yesterday") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateStamp(d);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;

  // Reject impossible dates like 2026-02-30
  const [y, m, day] = input.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return input;
}

// Find the channel from a mention (<#123>), a name (general / #general), or default to the current one
function resolveChannel(message, arg) {
  if (!arg) return message.channel;
  const mention = arg.match(/^<(?:#|@)(\d+)>$/);
  if (mention && arg.startsWith("<#")) return message.guild.channels.cache.get(mention[1]) || null;
  const name = arg.replace(/^#/, "").toLowerCase();
  return message.guild.channels.cache.find((c) => c.name?.toLowerCase() === name) || null;
}

function splitText(text, limit) {
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

// Single-file mode: keep only one channel's lines, plus their indented continuation lines
function filterByChannel(text, guildName, channelName) {
  const tag = `[${guildName} #${channelName}] `;
  const out = [];
  let keep = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("[")) {
      // New message line: "[timestamp] [Server #channel] author: text"
      const afterTime = line.slice(line.indexOf("] ") + 2);
      keep = afterTime.startsWith(tag);
    }
    // Indented lines belong to the message above, so they follow its keep/skip decision
    if (keep && line) out.push(line);
  }
  return out.join("\n");
}

module.exports = function registerLogCommand(client, options = {}) {
  const {
    logDir = "logs",
    splitByChannel = true, // must match what messageLogger uses
    prefix = "!",
    command = "log",
    requiredPermission = PermissionFlagsBits.ManageMessages, // who may read logs; null = anyone
  } = options;

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

	// Split command apart into [command] [date] [channel]
    const parts = message.content.trim().split(/\s+/);
    if (parts[0].toLowerCase() !== prefix + command) return; // so "!logs" etc. won't trigger

    const dateArg = parts[1];
    const channelArg = parts.slice(2).join(" "); // thread names can contain spaces

    try {
      // Only allowed members can read logs
      if (requiredPermission && !message.member?.permissions.has(requiredPermission)) {
        return message.reply("You don't have permission to view logs.");
      }

      const date = parseDate(dateArg);
      if (!date) {
        return message.reply(`Usage: \`${prefix}${command} YYYY-MM-DD [#channel]\` (or \`today\` / \`yesterday\`)`);
      }

      const channel = resolveChannel(message, channelArg);
      // Same reply for "doesn't exist" and "you can't see it", so hidden channels aren't revealed
      if (!channel || !channel.permissionsFor(message.member)?.has(PermissionFlagsBits.ViewChannel)) {
        return message.reply("Channel not found.");
      }

      const filePath = splitByChannel
        ? path.join(logDir, safeName(message.guild.name), safeName(channel.name), `${date}.txt`)
        : path.join(logDir, `${date}.txt`);

      // Read the log file
      let text;
      try {
        text = await fs.promises.readFile(filePath, "utf8");
      } catch (err) {
        if (err.code === "ENOENT") return message.reply(`No log for #${channel.name} on ${date}.`);
        throw err;
      }

      // In single-file mode the file has every channel, so pull out just this one
      if (!splitByChannel) text = filterByChannel(text, message.guild.name, channel.name);
      text = text.trimEnd();
      if (!text) return message.reply(`No messages in #${channel.name} on ${date}.`);

      const chunks = splitText(text, EMBED_TEXT_LIMIT);
      const visibleChunks = chunks.slice(0, MAX_EMBEDS);
      const embeds = visibleChunks.map((chunk, index) => {
        const safeText = chunk.replace(/```/g, "`\u200b``");
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle(index === 0
            ? `Conversation Log — #${channel.name}`
            : `Conversation Log — Continued (${index + 1}/${visibleChunks.length})`)
          .setDescription(`\`\`\`\n${safeText}\n\`\`\``)
          .setTimestamp();

        if (index === 0) embed.setFooter({ text: `Log date: ${date}` });
        return embed;
      });

      if (chunks.length > MAX_EMBEDS) {
        return message.reply({
          content: `The log was too long to display completely (${chunks.length - MAX_EMBEDS} additional embed section(s) omitted).`,
          embeds,
        });
      }

      return message.reply({ embeds });
    } catch (err) {
      console.error("Log command failed:", err);
      message.reply("Something went wrong reading that log.").catch(() => {});
    }
  });

  console.log(`Log command on: ${prefix}${command} <date> [#channel]`);
};
