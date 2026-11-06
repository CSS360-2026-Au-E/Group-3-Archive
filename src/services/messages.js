// Fetches messages from a Discord channel and returns them oldest-first as
// [{ content, author, timestamp }], with bot messages and empty messages removed.
//
//   fetchMessages(channel, { count: 20 })          -> the last 20 human messages
//   fetchMessages(channel, { sinceMs: 3600000 })   -> every human message in the last hour
//
// Later this can read from the team's chat "database" instead of Discord;
// as long as it returns the same shape, /summarize won't need to change.

export const MAX_MESSAGES = 500; // safety cap for long time ranges
const PAGE_SIZE = 100; // Discord's limit per request

function keep(message) {
  return !message.author?.bot && message.content?.trim();
}

function toPlain(message) {
  return {
    content: message.content.trim(),
    author: message.member?.displayName ?? message.author?.username ?? "Unknown",
    timestamp: message.createdAt,
  };
}

export async function fetchMessages(channel, { count = 20, sinceMs = null } = {}) {
  const collected = [];

  if (sinceMs) {
    // Page backwards through history until we pass the cutoff time.
    const cutoff = Date.now() - sinceMs;
    let before;

    while (collected.length < MAX_MESSAGES) {
      const batch = [...(await channel.messages.fetch({ limit: PAGE_SIZE, before })).values()];
      if (batch.length === 0) break;

      for (const message of batch) {
        if (message.createdTimestamp >= cutoff && keep(message)) collected.push(message);
      }

      const oldest = batch[batch.length - 1];
      if (oldest.createdTimestamp < cutoff || batch.length < PAGE_SIZE) break;
      before = oldest.id;
    }
  } else {
    // One request of 100, then keep the newest `count` human messages,
    // so bot replies don't eat into the count.
    const batch = [...(await channel.messages.fetch({ limit: PAGE_SIZE })).values()];
    collected.push(...batch.filter(keep).slice(0, count));
  }

  return collected
    .slice(0, MAX_MESSAGES)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(toPlain);
}