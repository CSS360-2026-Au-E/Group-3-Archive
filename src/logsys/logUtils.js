// Shared helpers for the log system. Every log file uses these, so the folder
// names and dates the logger writes always match what the commands look up.
// Change something here once and every file picks it up.

// Replace characters that aren't allowed in file or folder names
// (\p{Cc} = any control character; needs the "u" flag)

function safeName(name) {
  let value;

  try {
    value = String(name || "unknown");
  } catch {
    return "unknown";
  }

  const cleaned = value
    .replace(/[<>:"/\\|?*]|\p{Cc}/gu, "_")
    .trim();

  if (!cleaned || cleaned === "." || cleaned === "..") {
    return "unknown";
  }

  return cleaned;
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

// Turn a date input into YYYY-MM-DD, or null if it's not valid.
// Accepts "YYYY-MM-DD", "today", "yesterday", or a Date object.
function parseDate(input) {
  if (input instanceof Date) return isNaN(input) ? null : dateStamp(input);
  if (typeof input !== "string") return null;

  const lower = input.trim().toLowerCase();
  if (lower === "today") return dateStamp(new Date());
  if (lower === "yesterday") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return dateStamp(d);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lower)) return null;

  // Reject impossible dates like 2026-02-30
  const [y, m, day] = lower.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return null;
  return lower;
}

// Longest date range anyone can request, in days (both ends included).
// Keeps range reads and summaries to a sensible size.
const MAX_RANGE_DAYS = 7;

// Thrown by getDateRange() for bad input. The message is written so it can be
// shown straight to a user (e.g. "End date is before the start date.").
class DateRangeError extends Error {}

// Every date from `from` to `to`, both included, as "YYYY-MM-DD" strings.
// Accepts the same inputs as parseDate(): "YYYY-MM-DD", "today", "yesterday", or a Date.
//
//   getDateRange("2026-11-01", "2026-11-03")  ->  ["2026-11-01", "2026-11-02", "2026-11-03"]
//   getDateRange("yesterday", "today")        ->  [yesterday, today]
//
// Throws DateRangeError if a date is invalid, the end is before the start,
// or the range is longer than maxDays.
function getDateRange(from, to, maxDays = MAX_RANGE_DAYS) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start) throw new DateRangeError(`Invalid start date "${from}". Use YYYY-MM-DD, today, or yesterday.`);
  if (!end) throw new DateRangeError(`Invalid end date "${to}". Use YYYY-MM-DD, today, or yesterday.`);
  // "YYYY-MM-DD" strings sort the same way as the dates they represent
  if (end < start) throw new DateRangeError(`End date ${end} is before start date ${start}.`);

  // Walk forward one calendar day at a time. Using local dates with setDate()
  // (rather than adding 24 hours) stays correct across daylight-saving changes.
  const [y, m, d] = start.split("-").map(Number);
  const cursor = new Date(y, m - 1, d);
  const dates = [];
  while (true) {
    const day = dateStamp(cursor);
    dates.push(day);
    if (day === end) break;
    if (dates.length >= maxDays) {
      // `day` is the last date that would still fit, so suggest it
      throw new DateRangeError(`Date ranges are limited to ${maxDays} days. The latest end date for ${start} is ${day}.`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

module.exports = { safeName, dateStamp, timeStamp, parseDate, getDateRange, DateRangeError, MAX_RANGE_DAYS };
