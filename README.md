# Group — Archive

**CSS 360 – Software Engineering | University of Washington Bothell | Autumn 2026**

Archive is a student team building a Discord bot as our quarter-long software engineering project. This repository is our group's fork of the course example bot. We use it to plan, track, and develop our work.

---

## 📌 Project Status

**Current phase:** Release 1.0


### Commands

The bot has two text commands:

| Command | Function |
|---|---|
| `!log YYYY-MM-DD [#channel]` | Reads the saved message log for the specified date and channel, then displays it in Discord embed(s). |
| `!log today [#channel]` | Displays today's log for the specified channel or the channel where the command was sent. |
| `!log yesterday [#channel]` | Displays yesterday's log. |

Examples:

- `!log today`
- `!log 2026-10-29 #general`

Commands require the **Manage Messages** permission. Logs omit `.logs` that don't exist or return a channel/date-not-found response.

The implementations are in `logCommand.js` and `summaryCommand.js`.

## Roadmap

- [x] Choose team name
- [x] Set up GitHub repo, Kanban board, and personal forks
- [x] Set up Discord deployment and test servers
- [x] Brainstorm bot ideas
- [x] Select final bot concept
- [x] Define initial user stories and story points
- [x] Build first working feature
- [x] Deploy to group server

---
