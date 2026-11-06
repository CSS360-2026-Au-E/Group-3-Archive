// Summarize a real conversation from a text file, without starting the bot.
//
//   npx esr scripts/trySummarize.js path/to/chat.txt
//
// The file can be either:
//   - lines you paste yourself:   Noah: when is the deadline?
//   - a file from the logger:      [2026-10-29 14:02:11] [Server #general] noah#0: when is the deadline?

import "dotenv/config";
import fs from "fs";
import { summarizeMessages } from "../src/services/ollama";

function parseLine(line) {
  const logged = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[[^\]]*\] ([^:]+): (.*)$/);
  if (logged) {
    const bot = / \[BOT\]$/.test(logged[2]);
    return { timestamp: new Date(logged[1].replace(" ", "T")), author: logged[2].replace(/ \[BOT\]$/, ""), content: logged[3], bot };
  }
  const simple = line.match(/^([^:]{1,40}): (.+)$/);
  if (simple) return { timestamp: new Date(), author: simple[1].trim(), content: simple[2] };
  return null;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx esr scripts/trySummarize.js path/to/chat.txt");
    process.exit(1);
  }

  const messages = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map(parseLine)
    .filter((m) => m && !m.bot && m.content.trim());

  console.log(`Read ${messages.length} messages from ${file}. Asking ${process.env.OLLAMA_MODEL}...`);
  const start = Date.now();
  const result = await summarizeMessages(messages);

  console.log(`\nDone in ${((Date.now() - start) / 1000).toFixed(1)}s (used ${result.includedCount} of ${messages.length} messages)\n`);
  console.log("Summary:", result.summary);
  console.log("Topics: ", result.topics.join(", ") || "(none)");
}

main().catch((error) => {
  console.error("Failed:", error.message);
  process.exit(1);
});