# Group — Archive

**CSS 360 – Software Engineering | University of Washington Bothell | Autumn 2026**

Archive is a student team building a Discord bot as our quarter-long software engineering project. This repository is our group's fork of the course example bot. We use it to plan, track, and develop our work.

---

## Local setup (Discord bot + Ollama)

This project uses one laptop as both the Discord bot host and the Ollama host.
The bot is online only while that laptop is awake, connected to the internet,
and running both processes below. No Docker or cloud server is required.

### One-time setup

1. Install Node.js and [Ollama](https://ollama.com/).
2. Clone the repository and open the project folder in VS Code.
3. Install the Node dependencies:

   ```powershell
   npm install
   ```

4. Download the configured model:

   ```powershell
   ollama pull qwen2.5:3b
   ```

5. Copy `.env.example` to `.env` and replace the values with the
   Discord application token, server ID, and channel ID.

Discord IDs can be copied after enabling **Developer Mode** in Discord under
**User Settings > Advanced**. Right-click the server or channel and select
**Copy ID**.

### Start the bot


```powershell
ollama serve
```

```powershell
npm start
```

### Quick checks

Before a demo, verify the setup with:

```powershell
ollama list
npm test
```

If Discord commands work but summaries fail, Ollama is usually not running or
the configured model has not been downloaded. If the bot does not appear
online at all, check `TOKEN` and confirm that `npm start` is still running.

---

## 📌 Project Status

**Current phase:** Release 1.5


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

### Conversation analysis

In the configured testing channel, the bot analyzes the 20 most recent messages
with the configured Ollama model. It identifies up to three discussion topics and
extracts explicit deadlines connected to specific tasks. Newly detected deadlines
are posted in the channel; an unchanged deadline list is not posted repeatedly.

Relative deadlines such as “tomorrow” and “by Friday” are resolved using the bot's
local date when possible.

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
