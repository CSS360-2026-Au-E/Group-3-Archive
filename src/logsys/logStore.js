// Core log functions - no Discord commands here, just reading and clearing log files.
// Slash commands call these, and any other code in the bot can call them too.
//
//   const createLogStore = require("./logsys/logStore");
//   const store = createLogStore(LOG_OPTIONS);   // same options as messageLogger
//
//   const log = await store.getLog({ guildName: "My Server", channelName: "general", date: "2026-10-29" });
//   if (log) console.log(log.text, log.count);
//
//   const range = await store.getLogRange({ guild, channel, from: "2026-11-01", to: "2026-11-07" });
//   if (range) console.log(range.days.length, range.count);   // max 7 days
//
//   const result = await store.clearLog({ guild, channel, date: "yesterday" });
//   console.log(result.removed);
//
// Channels can be given as names (guildName / channelName) or as discord.js
// objects (guild / channel). Dates can be "YYYY-MM-DD", "today", "yesterday", or a Date.

const fs = require("fs");
const path = require("path");
const { safeName, parseDate, getDateRange, DateRangeError } = require("./logUtils");

// Count messages in a log (each message starts with "[timestamp]")
function countMessages(text) {
  return text.split("\n").filter((line) => line.startsWith("[")).length;
}

// Split a shared (all-channels) log into one channel's lines and everything else.
// Indented continuation lines stay with the message above them.
function splitChannelLines(text, guildName, channelName) {
  const tag = `[${guildName} #${channelName}] `;
  const match = [];
  const rest = [];
  let isMatch = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("[")) {
      const afterTime = line.slice(line.indexOf("] ") + 2);
      isMatch = afterTime.startsWith(tag);
    }
    if (!line) continue;
    (isMatch ? match : rest).push(line);
  }
  return { match: match.join("\n"), rest: rest.join("\n") };
}

// Error thrown for bad input, so callers can tell it apart from file system errors
class LogInputError extends Error {}

module.exports = function createLogStore(options = {}) {
  const { logDir = "logs", splitByChannel = true } = options; // must match messageLogger

  // Work out names and the file path from whatever the caller passed in
  function resolve({ guild, channel, guildName, channelName, date }) {
    const g = guildName ?? guild?.name;
    const c = channelName ?? channel?.name;
    if (!g || !c) throw new LogInputError("A guild and channel (or guildName and channelName) are required.");

    const day = parseDate(date);
    if (!day) throw new LogInputError(`Invalid date "${date}". Use YYYY-MM-DD, today, or yesterday.`);

    const filePath = splitByChannel
      ? path.join(logDir, safeName(g), safeName(c), `${day}.txt`)
      : path.join(logDir, `${day}.txt`);

    return { guildName: g, channelName: c, date: day, filePath };
  }

  // Read a file, returning null if it doesn't exist
  async function readIfExists(filePath) {
    try {
      return await fs.promises.readFile(filePath, "utf8");
    } catch (err) {
      if (err.code === "ENOENT") return null;
      throw err;
    }
  }

  /**
   * Get one channel's log for one day.
   * Returns { guildName, channelName, date, text, count }, or null if there are no messages.
   * Throws LogInputError for a bad date or missing channel.
   */
  async function getLog(args) {
    const r = resolve(args);
    const raw = await readIfExists(r.filePath);
    if (raw === null) return null;

    const text = (splitByChannel ? raw : splitChannelLines(raw, r.guildName, r.channelName).match).trimEnd();
    const count = countMessages(text);
    if (count === 0) return null;

    return { guildName: r.guildName, channelName: r.channelName, date: r.date, text, count };
  }

  /**
   * Get one channel's logs for every day in a date range (max 7 days, both ends included).
   * Takes the same arguments as getLog(), with `from` and `to` instead of `date`.
   *
   * Returns null if no day in the range has messages, otherwise:
   *   {
   *     guildName, channelName,
   *     from, to,     the full requested range as "YYYY-MM-DD"
   *     dayCount,     number of days in the range (including empty ones)
   *     days,         [{ date, text, count }] for days that have messages, oldest first
   *     count,        total messages across all days
   *     text          all days joined, each under a "===== YYYY-MM-DD =====" heading
   *   }
   *
   * Use `days` (not `text`) if you need to process each day separately - the
   * summarizer does this. Throws LogInputError for bad dates or a range over 7 days.
   */
  async function getLogRange({ from, to, ...where }) {
    let dates;
    try {
      dates = getDateRange(from, to);
    } catch (err) {
      // Re-throw as LogInputError so callers handle it like any other bad input
      if (err instanceof DateRangeError) throw new LogInputError(err.message);
      throw err;
    }

    // Read each day with getLog(), so a range behaves exactly like single days
    const days = [];
    let guildName;
    let channelName;
    for (const date of dates) {
      const log = await getLog({ ...where, date });
      if (log) {
        days.push({ date: log.date, text: log.text, count: log.count });
        ({ guildName, channelName } = log);
      }
    }
    if (!days.length) return null;

    return {
      guildName,
      channelName,
      from: dates[0],
      to: dates[dates.length - 1],
      dayCount: dates.length,
      days,
      count: days.reduce((n, d) => n + d.count, 0),
      text: days.map((d) => `===== ${d.date} =====\n${d.text}`).join("\n\n"),
    };
  }

  /**
   * Permanently remove one channel's log for one day.
   * Returns { guildName, channelName, date, removed } - removed is 0 if there was nothing to clear.
   * Throws LogInputError for a bad date or missing channel.
   */
  async function clearLog(args) {
    const r = resolve(args);
    const raw = await readIfExists(r.filePath);
    const result = { guildName: r.guildName, channelName: r.channelName, date: r.date, removed: 0 };
    if (raw === null) return result;

    if (splitByChannel) {
      // The whole file belongs to this channel, so delete it
      result.removed = countMessages(raw);
      await fs.promises.unlink(r.filePath);
      return result;
    }

    // Shared file: keep every other channel's lines
    const { match, rest } = splitChannelLines(raw, r.guildName, r.channelName);
    result.removed = countMessages(match);
    if (result.removed === 0) return result;

    if (!rest) {
      await fs.promises.unlink(r.filePath);
    } else {
      // Write to a temp file, then swap it in, so a crash can't leave a half-written log
      const tmpPath = `${r.filePath}.tmp`;
      await fs.promises.writeFile(tmpPath, rest + "\n", "utf8");
      await fs.promises.rename(tmpPath, r.filePath);
    }
    return result;
  }

  return { getLog, getLogRange, clearLog, parseDate };
};

module.exports.LogInputError = LogInputError;
