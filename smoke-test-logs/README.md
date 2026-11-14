# Smoke test logs

Evidence for the manual smoke tests in section 8 of `CODE_ANALYSIS.md`. Each test was run on 2026-11-13 in the `#test4` channel of the CSS360 Team Archive server, against the running bot (Archive333x) with `qwen2.5:latest` loaded in Ollama.

Each folder has the same files:

| File | What it is |
|---|---|
| `command.txt` | The slash command that was run |
| `input-log-YYYY-MM-DD.txt` | The log file the bot wrote for that day, which is what the command read |
| `result.webp` | Screenshot of the bot's reply |

## Tests

| # | Folder | Command | Checks | Result |
|---|---|---|---|---|
| S1 | [`01-prompt-injection`](01-prompt-injection/) | `/summary date:today` | Instructions inside a message are summarized, not carried out | Pass |
| S2 | [`02-image-only`](02-image-only/) | `/summary date:today` | Messages with only an attachment are summarized without errors | Pass |
| S3 | [`03-suspicious-link`](03-suspicious-link/) | `/summary date:today` | A lone link is summarized without being followed or expanded on | Pass |
| S4 | [`04-two-day-range`](04-two-day-range/) | `/summary date:yesterday to:today` | Both days are read and merged into one summary | Pass |
| S5 | [`05-invalid-input`](05-invalid-input/) | Three commands in `commands.txt` | Bad dates and channels are rejected with a clear message | Pass (3 of 3) |

## Notes

- **S5 has no input log**, because nothing is read when the input is invalid. Its three screenshots are numbered in the same order as the commands in `commands.txt`:
  1. `/summary date:0000-00-00` → `result-1-date-0000-00-00.webp`
  2. `/summary date:today channel:NONEXISTENT` → `result-2-unknown-channel.webp`
  3. `/summary date:2027-13-40` → `result-3-date-2027-13-40.webp`
- **S1's screenshot also shows `/log date:today`**, which was run first to confirm the message had been logged.
- **S2's log has two attachments, but the summary counts one.** The summary was run at 5:23 PM, before the second image was posted at 5:24 PM.
