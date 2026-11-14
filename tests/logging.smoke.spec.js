
const { expect } = require("chai");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");
const { Events } = require("discord.js");

const registerMessageLogger = require("../src/logsys/messageLogger");
const createLogStore = require("../src/logsys/logStore");

describe("Logging smoke test", function () {
  let tempDir;
  let client;
  let store;

  beforeEach(function () {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "archivebot-smoke-"));
    client = new EventEmitter();
    store = createLogStore({ logDir: tempDir });
  });

  afterEach(function () {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should log a Discord message and retrieve it", async function () {
    registerMessageLogger(client, { logDir: tempDir });

    const message = {
      createdAt: new Date(2026, 10, 13, 12, 0, 0),
      guild: { name: "Smoke Test Server" },
      channel: { name: "general" },
      author: { tag: "Tester#1234", bot: false },
      content: "Hello from the smoke test!",
      attachments: new Map(),
      embeds: [],
      stickers: new Map(),
    };

    client.emit(Events.MessageCreate, message);

    // Allow the logger's queued file write to finish.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const result = await store.getLog({
      guildName: "Smoke Test Server",
      channelName: "general",
      date: "2026-11-13",
    });

    expect(result).to.not.equal(null);
    expect(result.count).to.equal(1);
    expect(result.text).to.include("Hello from the smoke test!");
    expect(result.text).to.include("Tester#1234");
  });

  it("should retrieve a date range and clear a log", async function () {
    const serverDir = path.join(tempDir, "Smoke Test Server", "general");
    fs.mkdirSync(serverDir, { recursive: true });

    fs.writeFileSync(
      path.join(serverDir, "2026-11-12.txt"),
      "[2026-11-12 10:00:00] [Smoke Test Server #general] Tester: Yesterday\n"
    );

    fs.writeFileSync(
      path.join(serverDir, "2026-11-13.txt"),
      "[2026-11-13 10:00:00] [Smoke Test Server #general] Tester: Today\n"
    );

    const range = await store.getLogRange({
      guildName: "Smoke Test Server",
      channelName: "general",
      from: "2026-11-12",
      to: "2026-11-13",
    });

    expect(range).to.not.equal(null);
    expect(range.count).to.equal(2);
    expect(range.days).to.have.lengthOf(2);

    const cleared = await store.clearLog({
      guildName: "Smoke Test Server",
      channelName: "general",
      date: "2026-11-13",
    });

    expect(cleared.removed).to.equal(1);

    const remaining = await store.getLog({
      guildName: "Smoke Test Server",
      channelName: "general",
      date: "2026-11-13",
    });

    expect(remaining).to.equal(null);
  });
});
