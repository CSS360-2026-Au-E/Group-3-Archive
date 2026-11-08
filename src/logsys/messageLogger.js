// Logs every Discord message to text files, one file per day.
//
// Default layout (splitByChannel: true):
//   logs/<server-name>/<channel-name>/2026-10-29.txt
//
// With splitByChannel: false:
//   logs/2026-10-29.txt
//
// Usage (in bot.js):
//   const registerMessageLogger = require("./logsys/messageLogger");
//   registerMessageLogger(client, LOG_OPTIONS);
//
// Requires the GuildMessages and MessageContent intents on the client.

const fs = require("fs");
const path = require("path");
const { Events } = require("discord.js");
const { safeName, dateStamp, timeStamp } = require("./logUtils");

function formatMessage(message) {
  const d = message.createdAt;
  const where = message.guild
    ? `${message.guild.name} #${message.channel.name}`
    : "DM";
  const author = `${message.author.tag}${message.author.bot ? " [BOT]" : ""}`;

  // Keep multi-line messages readable by indenting continuation lines
  let text = (message.content || "").replace(/\n/g, "\n    ");

  const extras = [];
  if (message.attachments.size) extras.push(...message.attachments.map((a) => `[attachment] ${a.name} ${a.url}`));
  if (message.embeds.length) extras.push(`[${message.embeds.length} embed(s)]`);
  if (message.stickers.size) extras.push(...message.stickers.map((s) => `[sticker] ${s.name}`));
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
  const { logDir = "logs", splitByChannel = true, includeBots = true } = options;

  // Writes are chained so lines always land in the order messages arrived
  let queue = Promise.resolve();
  const createdDirs = new Set();

  // Run after client sends message
  client.on(Events.MessageCreate, (message) => {
    if (!includeBots && message.author.bot) return;

    const filePath = filePathFor(message, logDir, splitByChannel);
    const line = formatMessage(message);

    queue = queue
      .then(async () => {
        // Create the folder the first time it's needed (the file itself is created by appendFile)
        const dir = path.dirname(filePath);
        if (!createdDirs.has(dir)) {
          await fs.promises.mkdir(dir, { recursive: true });
          createdDirs.add(dir);
        }
        await fs.promises.appendFile(filePath, line, "utf8");
      })
      .catch((err) => console.error("Message log write failed:", err));
  });

  // Console setup message
  console.log(
    `Message logger on: ${path.resolve(logDir)} (${splitByChannel ? "per channel" : "all channels"}, one file per day)`
  );
};
