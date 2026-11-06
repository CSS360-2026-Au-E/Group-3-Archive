## Code Architecture

### Module structure

`src/bot.js` is the entry point. It registers features in two ways:

1. **Folder-loaded modules.** `loadCommands.js` and `loadEvents.js` read every `.js` file in `src/commands/` and `src/events/` and attach it to the Discord client. Slash commands like `/summarize` work this way.
2. **Register-function modules.** `messageLogger.js`, `logCommand.js`, and `summaryCommand.js` each export a `register(client, options)` function that `bot.js` calls directly. These handle message logging and the `!log` / `!summary` prefix commands.

`/summarize` follows a **command → services** pattern. The command file handles only Discord interaction logic: options, deferring, replying, and errors. The real work happens in three services, each with one job:

| Module | Responsibility |
|---|---|
| `services/messages.js` | Fetch channel history (by count or by time span), drop bot and empty messages, return `{ content, author, timestamp }` oldest-first |
| `services/ollama.js` | Build a size-limited transcript, send one request to Qwen, parse `{ summary, topics }` |
| `services/summaryEmbed.js` | Turn the result into a Discord embed |
| `helpers/parseTimeRange.js` | Turn text like `"last hour"` or `"3h"` into milliseconds (max 1 week) |

The services are passed into `execute()` through a `deps` object, so the unit tests in `tests/summarize.spec.js` can swap in fakes and never call Discord or Ollama.

```mermaid
flowchart LR
  bot["bot.js<br/>creates Discord client"]

  subgraph helpers["src/helpers"]
    lc["loadCommands.js"]
    le["loadEvents.js"]
    lf["loadFiles.js"]
    ptr["parseTimeRange.js"]
    it["identifyTopics.js"]
  end

  subgraph events["src/events"]
    ready["ready.js<br/>registers slash commands"]
    ic["interactionCreate.js<br/>routes slash commands"]
    mc["messageCreate.js<br/>auto topic + deadline analysis"]
  end

  subgraph commands["src/commands"]
    sum["summarize.js<br/>/summarize"]
  end

  subgraph services["src/services"]
    msg["messages.js<br/>fetchMessages()"]
    oll["ollama.js<br/>summarizeMessages()"]
    emb["summaryEmbed.js<br/>buildSummaryReply()"]
  end

  subgraph prefixmods["Prefix-command modules"]
    ml["messageLogger.js"]
    log["logCommand.js<br/>!log"]
    sc["summaryCommand.js<br/>!summary"]
  end

  discord[("Discord API")]
  ollama[("Ollama + Qwen")]
  logs[("logs folder")]

  bot --> lc
  bot --> le
  bot --> ml
  bot --> log
  bot --> sc
  lc --> lf
  le --> lf
  lc --> sum
  le --> ready
  le --> ic
  le --> mc
  ic -->|"client.commands.get()"| sum
  sum --> ptr
  sum --> msg
  sum --> oll
  sum --> emb
  msg --> discord
  oll --> ollama
  mc --> it
  it --> ollama
  sc --> ollama
  ml --> logs
  log --> logs
  sc --> logs
```

### `/summarize` control flow

If the `period` text is invalid, the command replies privately right away. Otherwise it calls `deferReply()`, because Discord only allows 3 seconds to respond and Qwen can take a minute or more. After deferring, it has 15 minutes to edit in the answer.

```mermaid
flowchart TD
  A["User runs /summarize with count or period"] --> B["interactionCreate.js finds command"]
  B --> C{"period given?"}
  C -- Yes --> D["parseTimeRange(period)"]
  D --> E{"Valid?"}
  E -- No --> F["Ephemeral reply: example formats"]
  E -- Yes --> G["deferReply()"]
  C -- No --> G
  G --> H{"period or count?"}
  H -- period --> I["fetchMessages: page back 100 at a time until cutoff, max 500"]
  H -- count --> J["fetchMessages: fetch 100, keep newest count human messages"]
  I --> K{"Zero messages?"}
  J --> K
  K -- Yes --> L["editReply: nothing to summarize"]
  K -- No --> M["summarizeMessages: trim transcript to 6000 chars, ask Qwen"]
  M --> N["buildSummaryReply: embed with summary, topics, footer"]
  N --> O["editReply with embed"]
  I -. throws .-> X["catch: log error, editReply apology"]
  J -. throws .-> X
  M -. throws .-> X
```

### Adding a new slash command

1. Create a file in `src/commands/` that default-exports `{ data, execute }`, where `data` is a `SlashCommandBuilder`.
2. Put reusable logic (fetching, AI calls, formatting) in `src/services/` so it can be tested on its own.
3. Restart the bot. `loadCommands.js` picks up the file, and `ready.js` registers it with Discord (instantly if `GUILD_ID` is set).