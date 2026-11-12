// Slash commands /log, /clearlog and /summary.
// These only handle Discord input and output - the real work is done by
// logsys/logStore.js (reading and clearing logs) and ollama/summarizer.js (summaries).
//
//   /log      date [to] [channel]           one day, or a range of up to 7 days
//   /clearlog date [channel] [confirm]      one day only
//   /summary  date [to] [channel]           one day, or a range of up to 7 days
//
// Usage (in bot.js):
//   import createLogStore from "./logsys/logStore.js";
//   import { registerSlashCommands } from "./slashCommands.js";
//   const store = createLogStore(LOG_OPTIONS);
//   registerSlashCommands(client, store);
//
// Run `npm run deploy` again after changing any command's options.

const {
  Events,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
  EmbedBuilder,
} = require("discord.js");
const { LogInputError } = require("./logsys/logStore");
const { MAX_RANGE_DAYS } = require("./logsys/logUtils");
const { summarizeLog, summarizeRange, summaryToEmbed, SummaryError } = require("./ollama/summarizer");

const CHAT_LIMIT = 1800; // print in chat below this many characters, attach above
const UPLOAD_LIMIT = 10 * 1024 * 1024; // Discord's default upload limit (10 MB)

// Channel types that have text chat
const TEXT_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildVoice,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
];

// ---------- Command definitions (what shows up in Discord's "/" menu) ----------

// Shared by /log and /summary: "date" is the day, or the start of a range when "to" is set
const START_DATE_HELP = "YYYY-MM-DD, today, or yesterday (the start date if 'to' is set)";
const END_DATE_HELP = `Optional end date, for a range of up to ${MAX_RANGE_DAYS} days`;

const logCommand = new SlashCommandBuilder()
  .setName("log")
  .setDescription("Show a channel's saved log for a date or date range")
  .addStringOption((o) => o.setName("date").setDescription(START_DATE_HELP).setRequired(true))
  .addStringOption((o) => o.setName("to").setDescription(END_DATE_HELP))
  .addChannelOption((o) =>
    o
      .setName("channel")
      .setDescription("Channel to show (defaults to this one)")
      .addChannelTypes(...TEXT_CHANNEL_TYPES)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // hidden from members without this
  .setDMPermission(false);

const clearLogCommand = new SlashCommandBuilder()
  .setName("clearlog")
  .setDescription("Permanently delete a channel's saved log for a date")
  .addStringOption((o) =>
    o.setName("date").setDescription("YYYY-MM-DD, today, or yesterday").setRequired(true)
  )
  .addChannelOption((o) =>
    o
      .setName("channel")
      .setDescription("Channel to clear (defaults to this one)")
      .addChannelTypes(...TEXT_CHANNEL_TYPES)
  )
  .addBooleanOption((o) =>
    o.setName("confirm").setDescription("Set to True to actually delete. Leave off to preview.")
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // stricter, since this deletes data
  .setDMPermission(false);

const summaryCommand = new SlashCommandBuilder()
  .setName("summary")
  .setDescription("Summarize a channel's saved log for a date or date range with the local AI model")
  .addStringOption((o) => o.setName("date").setDescription(START_DATE_HELP).setRequired(true))
  .addStringOption((o) => o.setName("to").setDescription(END_DATE_HELP))
  .addChannelOption((o) =>
    o
      .setName("channel")
      .setDescription("Channel to summarize (defaults to this one)")
      .addChannelTypes(...TEXT_CHANNEL_TYPES)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages) // same as /log: it reveals log content
  .setDMPermission(false);

// ---------- Handlers (call logStore, then reply) ----------

// Picked channel, or the one the command was used in; null if the user can't see it
function pickChannel(interaction) {
  const channel = interaction.options.getChannel("channel") ?? interaction.channel;
  const canSee = channel?.permissionsFor?.(interaction.member)?.has(PermissionFlagsBits.ViewChannel);
  return canSee ? channel : null;
}

// Read the logs a /log or /summary command asked for: one day, or a range when
// the "to" option is filled in. Returns either { empty: "message to show" } or:
//   {
//     channelName, count, text,
//     when,      "on 2026-11-05" or "from 2026-11-01 to 2026-11-07" - for messages
//     period,    "2026-11-05"    or "2026-11-01 to 2026-11-07"      - for titles
//     fileTag,   "2026-11-05"    or "2026-11-01_to_2026-11-07"      - for file names
//     range,     the full getLogRange() result, or null for a single day
//   }
// Bad dates or a range over 7 days throw LogInputError, which the handler at
// the bottom of this file shows to the user.
async function readRequestedLogs(interaction, store, channel) {
  const date = interaction.options.getString("date");
  const to = interaction.options.getString("to");
  const where = { guild: interaction.guild, channel };

  if (!to) {
    const log = await store.getLog({ ...where, date });
    if (!log) return { empty: `No messages logged in #${channel.name} on ${store.parseDate(date)}.` };
    return {
      channelName: log.channelName,
      count: log.count,
      text: log.text,
      when: `on ${log.date}`,
      period: log.date,
      fileTag: log.date,
      range: null,
    };
  }

  const range = await store.getLogRange({ ...where, from: date, to });
  if (!range) {
    // getLogRange() already checked both dates, so parseDate() can't fail here
    return { empty: `No messages logged in #${channel.name} from ${store.parseDate(date)} to ${store.parseDate(to)}.` };
  }
  const oneDay = range.from === range.to; // e.g. date and to both "2026-11-04"
  return {
    channelName: range.channelName,
    count: range.count,
    text: range.text,
    when: oneDay ? `on ${range.from}` : `from ${range.from} to ${range.to}`,
    period: oneDay ? range.from : `${range.from} to ${range.to}`,
    fileTag: oneDay ? range.from : `${range.from}_to_${range.to}`,
    range,
  };
}

async function handleLog(interaction, store) {
  const channel = pickChannel(interaction);
  if (!channel) return interaction.editReply("Channel not found.");

  const logs = await readRequestedLogs(interaction, store, channel);
  if (logs.empty) return interaction.editReply(logs.empty);

  // e.g. "Log for #general from 2026-11-01 to 2026-11-07 (42 message(s) across 3 day(s)):"
  const days = logs.range ? ` across ${logs.range.days.length} day(s)` : "";
  const header = `Log for #${logs.channelName} ${logs.when} (${logs.count} message(s)${days}):`;

  // Short: print in a code block (break up any ``` so the block doesn't close early)
  if (logs.text.length <= CHAT_LIMIT) {
    const safeText = logs.text.replace(/```/g, "`\u200b``");
    return interaction.editReply(`${header}\n\`\`\`\n${safeText}\n\`\`\``);
  }

  // Long: send as a .txt attachment
  const buffer = Buffer.from(logs.text, "utf8");
  if (buffer.length > UPLOAD_LIMIT) {
    return interaction.editReply(`That log is too large to upload (${(buffer.length / 1048576).toFixed(1)} MB).`);
  }
  const file = new AttachmentBuilder(buffer, { name: `${logs.channelName}_${logs.fileTag}.txt` });
  return interaction.editReply({ content: header, files: [file] });
}

async function handleClearLog(interaction, store) {
  const channel = pickChannel(interaction);
  if (!channel) return interaction.editReply("Channel not found.");

  const date = interaction.options.getString("date");
  const confirmed = interaction.options.getBoolean("confirm") ?? false;

  // Without confirm: preview only
  if (!confirmed) {
    const log = await store.getLog({ guild: interaction.guild, channel, date });
    if (!log) return interaction.editReply(`No messages logged in #${channel.name} on ${store.parseDate(date)}.`);
    return interaction.editReply(
      `This would permanently delete **${log.count}** logged message(s) from #${log.channelName} on ${log.date}.\n` +
        `Run the command again with **confirm: True** to do it.`
    );
  }

  const result = await store.clearLog({ guild: interaction.guild, channel, date });
  if (result.removed === 0) {
    return interaction.editReply(`No messages logged in #${result.channelName} on ${result.date}.`);
  }

  // Audit trail in the console: who cleared what
  console.log(
    `Log cleared by ${interaction.user.tag}: #${result.channelName} ${result.date} (${result.removed} message(s))`
  );
  return interaction.editReply(
    `Cleared ${result.removed} logged message(s) from #${result.channelName} on ${result.date}.`
  );
}

// Only one summary at a time, so a local model isn't overloaded by parallel requests
let summaryRunning = false;

async function handleSummary(interaction, store) {
  const channel = pickChannel(interaction);
  if (!channel) return interaction.editReply("Channel not found.");

  const logs = await readRequestedLogs(interaction, store, channel);
  if (logs.empty) return interaction.editReply(logs.empty);

  if (summaryRunning) {
    return interaction.editReply("Another summary is in progress. Try again in a minute.");
  }
  summaryRunning = true;

  try {
    await interaction.editReply(`Summarizing ${logs.count} message(s) from #${logs.channelName} ${logs.when}…`);

    // Long days and ranges are summarized in parts; show progress so it doesn't look stuck
    const onProgress = (part, total) =>
      total > 1
        ? interaction
            .editReply(`Summarizing #${logs.channelName} ${logs.when}: part ${part} of ${total}…`)
            .catch(() => {})
        : undefined;

    const summary = logs.range
      ? await summarizeRange(logs.range.days, {
          channelName: logs.channelName,
          from: logs.range.from,
          to: logs.range.to,
          onProgress,
        })
      : await summarizeLog(logs.text, { channelName: logs.channelName, date: logs.period, onProgress });

    if (!summary) {
      return interaction.editReply(`Only bot messages were logged in #${logs.channelName} ${logs.when}.`);
    }

    const embed = new EmbedBuilder(summaryToEmbed(summary, { channelName: logs.channelName, date: logs.period }));
    return interaction.editReply({ content: "", embeds: [embed], allowedMentions: { parse: [] } });
  } catch (err) {
    if (err instanceof SummaryError) return interaction.editReply(`Couldn't summarize: ${err.message}`);
    throw err;
  } finally {
    summaryRunning = false;
  }
}

// Command name -> handler
const handlers = {
  log: handleLog,
  clearlog: handleClearLog,
  summary: handleSummary,
};

function registerSlashCommands(client, store) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;
    const handler = handlers[interaction.commandName];
    if (!handler) return;

    try {
      // Reply privately (only the requester sees it) and buy time past Discord's 3-second limit
      await interaction.deferReply({ ephemeral: true });
	  // Register commands defined here
      await handler(interaction, store);
    } catch (err) {
      const msg = err instanceof LogInputError ? err.message : "Something went wrong.";
      if (!(err instanceof LogInputError)) console.error(`/${interaction.commandName} failed:`, err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg).catch(() => {});
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
    }
  });

  console.log(`Slash commands on: /${Object.keys(handlers).join(", /")}`);
}

// Definitions are exported for deploy-commands.js
module.exports = {
  commands: [logCommand, clearLogCommand, summaryCommand],
  registerSlashCommands,
};
