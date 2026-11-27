// Text matching for /find - no files or Discord here, just "does this log text
// mention a topic?" Kept separate from logStore.js so it's easy to unit test.
//
//   const { searchText } = require("./logsys/logSearch");
//   const result = searchText(log.text, "ollama");
//   // -> { hits: 3, sample: { author: "noah", text: "ollama needs 127.0.0.1" } } or null

// Longest sample message shown in /find results
const SAMPLE_LENGTH = 100;

// Split a day's log text into one string per message. Each message starts with
// "[timestamp]"; indented continuation lines belong to the message above.
function splitMessages(text) {
  const messages = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("[")) messages.push(line);
    else if (line.trim() && messages.length) messages[messages.length - 1] += "\n" + line.trim();
  }
  return messages;
}

// Pull the author and message text out of one log line, written by messageLogger as:
//   [2026-11-05 14:03:22] [Server Name #channel] author [BOT]: message text
// Channel names can't contain spaces or "]", so " #channel] " marks the end of
// the location part even if the server name has brackets in it.
// Returns { author, isBot, text }, or null if the line isn't in that format.
const LINE_FORMAT = /^\[[^\]]*\] \[(?:.*? #[^\s\]]*|DM)\] (.+?)( \[BOT\])?: ([\s\S]*)$/;

function parseMessage(message) {
  const m = LINE_FORMAT.exec(message);
  if (!m) return null;
  return { author: m[1], isBot: Boolean(m[2]), text: m[3] };
}

// Build a case-insensitive regex for the topic that matches it as a whole word
// or phrase ("log" matches "log" but not "blog"). The topic is escaped first,
// so input like "c++" or "(a+)+" is treated as plain text and can't break or
// freeze the search. Returns null for an empty topic.
function topicRegex(topic) {
  const words = String(topic ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  // Lookarounds instead of \b, so topics that start or end with symbols ("c++", ".env") still work
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "iu");
}

// Shorten a message for display
function shorten(text, max = SAMPLE_LENGTH) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : oneLine.slice(0, max - 1) + "…";
}

/**
 * Count the messages in one log's text that mention the topic.
 * Bot messages are skipped (the bot's own replies would otherwise match), and only
 * the message text is searched - not timestamps, channel names, or author names.
 * `topic` can be a string or a regex from topicRegex().
 * Returns { hits, sample: { author, text } } for the first match, or null if there are none.
 */
function searchText(text, topic) {
  const regex = topic instanceof RegExp ? topic : topicRegex(topic);
  if (!regex || !text) return null;

  let hits = 0;
  let sample = null;
  for (const raw of splitMessages(text)) {
    const msg = parseMessage(raw);
    if (!msg || msg.isBot || !regex.test(msg.text)) continue;
    hits++;
    if (!sample) sample = { author: msg.author, text: shorten(msg.text) };
  }
  return hits ? { hits, sample } : null;
}

module.exports = { splitMessages, parseMessage, topicRegex, searchText, shorten, SAMPLE_LENGTH };