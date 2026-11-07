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

## Startup Architecture (`npm start`) - Emma part

`npm start` first builds the source code, then starts ArchiveBot using settings from `.env`.

The command in `package.json` is:

```text
npm run build && node -r dotenv/config build/bot.js
```

The `&&` is an important boundary. Node starts the bot only if the build succeeds. This prevents the application from running an incomplete build after a compilation error.

### Startup sequence

1. `npm start` invokes the `start` script in `package.json`.
2. `npm run build` executes `node build.js`.
3. `build.js` deletes the previous `build/` directory, recursively finds every JavaScript file under `src/`, and passes those files to esbuild.
4. esbuild preserves the directory structure while translating the source modules into CommonJS files under `build/`. For example, `src/events/ready.js` becomes `build/events/ready.js`. CommonJS output is required because the runtime loaders use `require()` to discover commands and events by file path.
5. If the build succeeds, Node preloads `dotenv/config`. This reads `.env` before `build/bot.js` accesses `process.env`.
6. `build/bot.js` creates the Discord client, registers the logger and prefix-command modules, creates the command and event collections, and loads the compiled files in `build/commands/` and `build/events/`.
7. `client.login(TOKEN)` authenticates with Discord and opens the gateway connection.
8. When Discord emits `ready`, `ready.js` publishes the loaded slash-command definitions. With `GUILD_ID`, commands are registered to one server and update quickly; without it, they are registered globally.
9. The Node process remains active and waits for Discord events. Stopping this process takes the bot offline.

```mermaid
flowchart TD
  user["Developer runs npm start"] --> start["package.json: start script"]
  start --> build["npm run build"]
  build --> clean["build.js removes old build folder"]
  clean --> scan["Find every JavaScript file under src"]
  scan --> compile["esbuild outputs CommonJS files under build"]
  compile --> built{"Build succeeded?"}
  built -- No --> stop["Stop; bot is not started"]
  built -- Yes --> env["Node preloads dotenv/config"]
  env --> entry["Run build/bot.js"]
  entry --> client["Create Discord client and collections"]
  client --> direct["Register logger and prefix commands"]
  client --> loaders["Load compiled slash commands and events"]
  direct --> login["client.login with TOKEN"]
  loaders --> login
  login --> authenticated{"Discord authentication succeeds?"}
  authenticated -- No --> offline["Startup fails; bot stays offline"]
  authenticated -- Yes --> ready["ready event registers slash commands"]
  ready --> online["Bot is online and waiting for events"]

  ollama["Separate process: ollama serve"]
  online -. "summary request" .-> ollama
```

### Configuration and external dependencies

ArchiveBot reads configuration at runtime rather than compiling it into `build/`. So, secrets remain outside Git, and the same build can run with different Discord servers or Ollama models.

| Setting or service | Role |
|---|---|
| `TOKEN` | Required by `client.login()`; a missing or invalid token prevents the bot from connecting to Discord. |
| `GUILD_ID` | Optional server ID used by `ready.js` for fast, server-specific slash-command registration. |
| `CHANNEL_NAME` | Selects the channel used by the welcome-message feature. |
| `TESTING_CHANNEL_ID` | Limits automatic topic and deadline analysis to the configured channel. |
| `OLLAMA_URL` | HTTP endpoint used for ai model. |
| `OLLAMA_MODEL` | Names the Ollama model, currently `qwen2.5:3b`. |
| Ollama | A separate local service. `npm start` does not launch it. The bot can start without Ollama, but requests fail until `ollama serve` is running and the model is installed. |

## Data Architecture

Archive Bot has two message-processing pipelines that run side by side:
 
1. **Message logging** saves every message to daily text files.
2. **Recent-message analysis** reads the latest messages in a test channel, sends them to the local Ollama model, and replies with the topics and deadlines it finds.
Both listen to Discord's `messageCreate` event, but they don't share code or data.
 
---
 
## 1. Message logging system
 
Every message the bot can see is formatted into one line of text and appended to a daily file for its channel.
 
```mermaid
flowchart TD
    A["Discord message<br/>(any channel the bot can see)"] --> B
 
    subgraph LOG["Logging · messageLogger.js"]
        B["messageCreate listener"] --> C{"Bot message and<br/>includeBots is false?"}
        C -- yes --> X["Skip"]
    end
 
    C -- no --> D
 
    subgraph FMT["Formatting · formatMessage()"]
        D["Timestamp<br/>YYYY-MM-DD HH:MM:SS (local time)"] --> E["Location and author<br/>[Server #channel] user"]
        E --> F["Message text<br/>extra lines indented 4 spaces"]
        F --> G["Extras<br/>attachments, embeds, stickers"]
    end
 
    G --> H
 
    subgraph STORE["Storage · filePathFor() + write queue"]
        H["Build file path<br/>safeName(), dateStamp()"] --> I["Write queue<br/>keeps lines in arrival order"]
        I --> J["Create folder if missing<br/>mkdir recursive"]
        J --> K["appendFile"]
    end
 
    K --> L[("logs/server/channel/YYYY-MM-DD.txt")]
```
 
**Example log line**
 
```
[2026-11-05 14:03:22] [My Server #general] alice: are we still on for Friday?
    I can book the room
```
 
---
 
## 2. Recent-message analysis system
 
Every human message in the configured test channel triggers an analysis of that channel's latest 20 messages.
 
```mermaid
flowchart TD
    A["Discord message"] --> B
 
    subgraph READ["Read previous messages · events/messageCreate.js"]
        B{"Bot message, or not in<br/>TESTING_CHANNEL_ID?"} -- yes --> X["Ignore"]
        B -- no --> C["Fetch last 20 messages"]
        C --> D["Reverse to oldest first"]
    end
 
    D --> E
 
    subgraph FMT["Format · helpers/identifyTopics.js"]
        E["Build transcript<br/>username: message"] --> F["Drop empty messages"]
        F --> G["Limit to 12,000 characters"]
    end
 
    G --> H
 
    subgraph AI["Input to Ollama"]
        H["POST OLLAMA_URL<br/>model: OLLAMA_MODEL, JSON format,<br/>temperature 0.2"] --> I["System prompt<br/>today's date, find 1-3 topics<br/>and task deadlines"]
        I --> J(["Ollama model"])
    end
 
    J --> K
 
    subgraph OUT["Data output"]
        K["parseConversationAnalysis()<br/>validate, trim, cap at<br/>3 topics and 10 deadlines"] --> L{"Deadlines changed<br/>since last reply?"}
        L -- yes --> M["Embed: topics + deadlines"]
        L -- no --> N["Embed: topics only"]
    end
 
    M --> R["Reply in channel<br/>(pings blocked)"]
    N --> R
    J -. "error" .-> E2["Reply: could not analyze"]
```
 
---
 