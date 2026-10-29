// Logs every Discord message to text files, one file per day.
//
// Default layout:
//   logs/2026-10-29.txt
//   logs/2026-10-30.txt
//
// With splitByChannel: true:
//   logs/<server-name>/<channel-name>/2026-10-29.txt
//
// Usage (in bot.js):
//   const registerMessageLogger = require("./messageLogger");
//   registerMessageLogger(client, { logDir: "logs", splitByChannel: false });
//
// Requires the GuildMessages and MessageContent intents on the client.

const fs = require("fs");
const path = require("path");
const { Events } = require("discord.js");

// Remove characters that aren't allowed in file or folder names
function safeName(name) {
  return String(name || "unknown").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim() || "unknown";
}

// YYYY-MM-DD in the machine's local time zone
function dateStamp(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// HH:MM:SS in local time
function timeStamp(d) {
  return d.toTimeString().slice(0, 8);
}

function formatMessage(message) {
  const d = message.createdAt;
  const where = message.guild
    ? `${message.guild.name} #${message.channel.name}`
    : "DM";
  const author = `${message.author.tag}${message.author.bot ? " [BOT]" : ""}`;

  // Keep multi-line messages readable by indenting continuation lines
  let text = (message.content || "").replace(/\n/g, "\n    ");

  const extras = [];
  if (message.attachments.size) {
    extras.push(...message.attachments.map((a) => `[attachment] ${a.name} ${a.url}`));
  }
  if (message.embeds.length) extras.push(`[${message.embeds.length} embed(s)]`);
  if (message.stickers.size) {
    extras.push(...message.stickers.map((s) => `[sticker] ${s.name}`));
  }
  if (extras.length) text += (text ? "\n    " : "") + extras.join("\n    ");

  return `[${dateStamp(d)} ${timeStamp(d)}] [${where}] ${author}: ${text}\n`;
}

function filePathFor(message, logDir, splitByChannel) {
  const file = `${dateStamp(message.createdAt)}.txt`;
  if (!splitByChannel) return path.join(logDir, file);

  const server = message.guild ? safeName(message.guild.name) : "DMs";
  const channel = message.guild ? safeName(message.channel.name) : safeName(message.author.tag);
  return path.join(logDir, server, channel, file);
}

module.exports = function registerMessageLogger(client, options = {}) {
  const {
    logDir = "logs",
    splitByChannel = true,
    includeBots = true, // set false to skip messages from bots (including this one)
  } = options;

  // Writes are chained so lines always land in the order messages arrived
  let queue = Promise.resolve();
  const createdDirs = new Set();

  client.on(Events.MessageCreate, (message) => {
    if (!includeBots && message.author.bot) return;

    const filePath = filePathFor(message, logDir, splitByChannel);
    const line = formatMessage(message);

    queue = queue
      .then(async () => {
        const dir = path.dirname(filePath);
        if (!createdDirs.has(dir)) {
          await fs.promises.mkdir(dir, { recursive: true });
          createdDirs.add(dir);
        }
        await fs.promises.appendFile(filePath, line, "utf8");
      })
      .catch((err) => console.error("Message log write failed:", err));
  });

  console.log(
    `Message logger on: ${path.resolve(logDir)} (${splitByChannel ? "per channel" : "all channels"}, one file per day)`
  );
};
