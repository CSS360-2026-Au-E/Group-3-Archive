# Archive Bot

Archive Bot is a Discord bot built by Team Archive for CSS 360 Software Engineering at the University of Washington Bothell. It saves channel conversations so team members can review past discussions and use Ollama to summarize decisions, action items, and open questions.

## Discord commands

| Command | What it does | Default permission |
| --- | --- | --- |
| `/log date [to] [channel]` | Shows saved messages for one day or a date range. Larger logs are sent as a text attachment, up to 10 MiB. | Manage Messages |
| `/summary date [to] [channel]` | Uses Ollama to summarize saved messages for one day or a date range. | Manage Messages |
| `/clearlog date [channel] [confirm]` | Previews deletion of a day's archive. Set `confirm` to true to delete it. | Manage Server |

Commands reply privately and default to the current channel. Enter dates as `YYYY-MM-DD`, `today`, or `yesterday`. Ranges include both dates and can cover up to seven days.

For example, run `/summary date:yesterday to:today` to catch up on the current channel.

## Run locally

You’ll need Node.js 22 or newer, a Discord bot application installed in a test server, and a running Ollama instance for `/summary`. Enable **Message Content Intent** and **Server Members Intent** under the application's Bot settings in the Discord Developer Portal.

From the repository root:

```sh
npm ci
cp .env-sample .env
```

Set these values in `.env`:

| Variable | Value |
| --- | --- |
| `TOKEN` | The Discord bot token. Keep this private. |
| `CLIENT_ID` | The Discord application ID. |
| `GUILD_ID` | Optional test server ID. Add it to register commands in one server. Leave it unset for global registration. |
| `OLLAMA_MODEL` | The name of a model available on your Ollama instance. |
| `OLLAMA_URL` | The Ollama chat endpoint. The sample uses `http://127.0.0.1:11434/api/chat`. |

```sh
npm run deploy
npm start
```

`npm run deploy` registers the slash commands with Discord. Run it again after changing command definitions. `npm start` builds and starts the bot.

### Verify your setup

1. Wait for `Logged in as ...` in the terminal.
2. Send a test message in a channel the bot can see. With an account that has **Manage Messages**, run `/log date:today` in that channel and check that the message appears in the private reply.
3. Run `/summary date:today` in the same channel to verify the Ollama connection. If it fails, check that Ollama is running and that `OLLAMA_MODEL` names a model available on that instance.

## Archive storage

Archive Bot writes plain-text logs to `logs/<server>/<channel>/YYYY-MM-DD.txt` as messages arrive. It can only summarize messages it has already captured. Use a persistent volume for `logs/` when running the bot in Docker. AI summaries can miss details, so check important decisions and deadlines against the saved conversation.

## Development

- Run `npm test` for the automated tests or `npm run coverage` for the coverage report.
- See [Architecture](ARCHITECTURE.md) for how the Discord client, log storage, and Ollama integration fit together.
- See [Deployment](DEPLOYMENT.md) for Docker, persistent storage, and GitHub Actions.
- See [Code analysis](CODE_ANALYSIS.md) and [smoke-test notes](smoke-test-logs/README.md) for the team's testing and findings.
