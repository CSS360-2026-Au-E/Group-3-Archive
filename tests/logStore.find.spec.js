const { describe, it, before, after } = require("mocha");
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const createLogStore = require("../src/logsys/logStore");
const { LogInputError } = require("../src/logsys/logStore");

// Write a fake log file the same way messageLogger lays them out
function writeLog(root, channel, date, lines) {
  const dir = path.join(root, "Archive", channel);
  fs.mkdirSync(dir, { recursive: true });
  const text = lines.map((l) => `[${date} 12:00:00] [Archive #${channel}] ${l}`).join("\n") + "\n";
  fs.writeFileSync(path.join(dir, `${date}.txt`), text);
}

describe("/find log search (logStore.searchLogs)", function () {
  let root;
  let store;

  before(function () {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "archive-find-"));
    writeLog(root, "general", "2026-11-01", ["noah: setting up ollama tonight", "es2: cool"]);
    writeLog(root, "general", "2026-11-03", ["vicky: nothing related here"]);
    writeLog(root, "general", "2026-11-05", ["noah: ollama timed out", "es2: restart ollama"]);
    writeLog(root, "dev", "2026-11-05", ["enkh: ollama needs 127.0.0.1"]);
    writeLog(root, "dev", "2026-11-06", ["ArchiveBot#1 [BOT]: summary mentions ollama"]);
    fs.writeFileSync(path.join(root, "Archive", "general", "notes.txt"), "not a log file");
    store = createLogStore({ logDir: root });
  });

  after(function () {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("lists a channel's dates oldest first, ignoring other files", async function () {
    const dates = await store.listDates({ guildName: "Archive", channelName: "general" });
    assert.deepStrictEqual(dates, ["2026-11-01", "2026-11-03", "2026-11-05"]);
  });

  it("returns no dates for a channel with no logs", async function () {
    assert.deepStrictEqual(await store.listDates({ guildName: "Archive", channelName: "empty" }), []);
  });

  it("finds a topic across channels, newest date first", async function () {
    const result = await store.searchLogs({ guildName: "Archive", channelNames: ["general", "dev"], topic: "Ollama" });

    assert.deepStrictEqual(result.dates.map((d) => d.date), ["2026-11-05", "2026-11-01"]);
    assert.strictEqual(result.totalHits, 4);
    assert.strictEqual(result.channelsSearched, 2);
    assert.strictEqual(result.daysSearched, 5);

    // 2026-11-05 has hits in both channels, the busier one first
    const nov5 = result.dates[0];
    assert.strictEqual(nov5.hits, 3);
    assert.deepStrictEqual(nov5.channels.map((c) => [c.channelName, c.hits]), [["general", 2], ["dev", 1]]);
    assert.deepStrictEqual(nov5.channels[0].sample, { author: "noah", text: "ollama timed out" });
  });

  it("ignores the bot's own messages", async function () {
    const result = await store.searchLogs({ guildName: "Archive", channelNames: ["dev"], topic: "summary" });
    assert.strictEqual(result.dates.length, 0);
  });

  it("only searches a duplicated channel name once", async function () {
    const result = await store.searchLogs({ guildName: "Archive", channelNames: ["general", "general"], topic: "ollama" });
    assert.strictEqual(result.channelsSearched, 1);
    assert.strictEqual(result.totalHits, 3);
  });

  it("rejects an empty topic", async function () {
    await assert.rejects(
      store.searchLogs({ guildName: "Archive", channelNames: ["general"], topic: "  " }),
      LogInputError
    );
  });
});