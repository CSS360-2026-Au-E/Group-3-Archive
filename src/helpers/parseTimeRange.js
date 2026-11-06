// Turns text like "1 day", "last hour", "3h", "past 30 minutes" into a time span.
// Returns { ms, label } or null if the text isn't understood.

const UNITS = {
  minute: { ms: 60 * 1000, aliases: ["m", "min", "mins", "minute", "minutes"] },
  hour: { ms: 60 * 60 * 1000, aliases: ["h", "hr", "hrs", "hour", "hours"] },
  day: { ms: 24 * 60 * 60 * 1000, aliases: ["d", "day", "days"] },
  week: { ms: 7 * 24 * 60 * 60 * 1000, aliases: ["w", "wk", "wks", "week", "weeks"] },
};

export const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000; // cap at one week

function findUnit(word) {
  return Object.entries(UNITS).find(([, unit]) => unit.aliases.includes(word));
}

export default function parseTimeRange(input) {
  if (!input) return null;

  const text = input.trim().toLowerCase();
  const match = text.match(/^(?:(?:last|past)\s+)?(\d+(?:\.\d+)?)?\s*([a-z]+)$/);
  if (!match) return null;

  const amount = match[1] === undefined ? 1 : Number(match[1]);
  const found = findUnit(match[2]);
  if (!found || !(amount > 0)) return null;

  const [name, unit] = found;
  const ms = Math.round(amount * unit.ms);
  if (ms > MAX_RANGE_MS) return null;

  const label = amount === 1 ? `the last ${name}` : `the last ${amount} ${name}s`;
  return { ms, label };
}