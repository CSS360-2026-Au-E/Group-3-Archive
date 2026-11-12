# Archive Bot: system diagram
 
```mermaid
flowchart TB
    DISCORD(["Discord"])
 
    subgraph START["npm start"]
        BOT["bot.js<br/>creates the client and LOG_OPTIONS,<br/>registers every module"]
        LOADER["helpers/loadEvents.js<br/>loads every file in events/"]
    end
 
    subgraph EVENTS["src/events"]
        READY["ready.js<br/>startup banner"]
        MEMBER["memberAdd.js<br/>welcome + logging notice"]
    end
 
    subgraph CMDS["src/slashCommands.js"]
        LOGC["/log<br/>one day or up to 7 days"]
        CLEAR["/clearlog<br/>one day, needs confirm"]
        SUM["/summary<br/>one day or up to 7 days"]
    end
 
    subgraph LOGSYS["src/logsys"]
        ML["messageLogger.js<br/>formats and writes every message"]
        LS["logStore.js<br/>getLog, getLogRange, clearLog"]
        LU["logUtils.js<br/>dates, date ranges, file names"]
    end
 
    subgraph AI["src/ollama"]
        SZ["summarizer.js<br/>split into parts, summarize,<br/>merge, build embed"]
    end
 
    FILES[("logs/<br/>server / channel / YYYY-MM-DD.txt")]
    OLLAMA(["Ollama<br/>local AI model"])
    DEPLOY["deploy-commands.js<br/>npm run deploy"]
 
    %% Startup wiring
    DISCORD -- "messages, member joins,<br/>slash commands" --> BOT
    BOT --> LOADER
    LOADER --> READY
    LOADER --> MEMBER
    BOT --> ML
    BOT --> LS
    BOT -- "registerSlashCommands" --> CMDS
 
    %% Logging: writing
    ML --> LU
    ML -- "append" --> FILES
 
    %% Logging: reading and clearing
    LOGC --> LS
    CLEAR --> LS
    SUM --> LS
    LS --> LU
    LS -- "read / delete" --> FILES
 
    %% Summaries
    SUM --> SZ
    SZ -- "HTTP /api/chat" --> OLLAMA
 
    %% Replies back to Discord
    CMDS -. "private replies" .-> DISCORD
    MEMBER -. "welcome message" .-> DISCORD
 
    %% Registering commands (separate script)
    DEPLOY -- "reads command list" --> CMDS
    DEPLOY -. "registers commands" .-> DISCORD
```
 
**How to read it**
 
- **Solid arrows** are calls or data flowing inward. **Dotted arrows** are messages going back out to Discord.
- **`bot.js`** starts everything. It loads the event files through `loadEvents`, starts `messageLogger`, creates the `logStore`, and registers the slash commands.
- **Writing logs:** `messageLogger` is the only part that writes to `logs/`. It uses `logUtils` for timestamps and file names.
- **Reading logs:** every slash command goes through `logStore`. It's the only part that reads or deletes log files, and it uses the same `logUtils` helpers, so it always looks where the logger wrote.
- **Summaries:** `/summary` gets the text from `logStore`, then passes it to `summarizer`, which is the only part that talks to Ollama.
- **`deploy-commands.js`** isn't part of the running bot. You run it separately to register the slash commands with Discord.