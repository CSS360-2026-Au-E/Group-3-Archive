const { describe, it } = require("mocha");
const assert = require("assert");

const { splitMessages, parseMessage, topicRegex, searchText } = require("../src/logsys/logSearch");

// A day's log in the same format messageLogger writes
const LOG = [
  "[2026-11-05 10:00:00] [Archive #general] noah: anyone got Ollama running in codespaces?",
  "[2026-11-05 10:01:00] [Archive #general] es2: yes, use 127.0.0.1",
  "    not localhost",
  "[2026-11-05 10:02:00] [Archive #general] ArchiveBot#1234 [BOT]: Summary: talked about ollama",
  "[2026-11-05 10:03:00] [Archive #general] vicky: my blog post is up",
  "[2026-11-05 10:04:00] [Archive #general] noah: OLLAMA works now",
].join("\n");

describe("/find text search (logSearch.js)", function () {
  describe("splitMessages", function () {
    it("keeps indented continuation lines with the message above", function () {
      const messages = splitMessages(LOG);
      assert.strictEqual(messages.length, 5);
      assert.ok(messages[1].endsWith("use 127.0.0.1\nnot localhost"));
    });
  });

  describe("parseMessage", function () {
    it("reads the author and text", function () {
      const msg = parseMessage("[2026-11-05 10:00:00] [Archive #general] noah: hello: world");
      assert.deepStrictEqual(msg, { author: "noah", isBot: false, text: "hello: world" });
    });

    it("flags bot messages", function () {
      const msg = parseMessage("[2026-11-05 10:00:00] [Archive #general] Bot#1 [BOT]: hi");
      assert.strictEqual(msg.isBot, true);
    });

    it("handles server names with brackets", function () {
      const msg = parseMessage("[2026-11-05 10:00:00] [Team [3] Archive #dev-chat] noah: hi");
      assert.strictEqual(msg.author, "noah");
      assert.strictEqual(msg.text, "hi");
    });

    it("returns null for lines in another format", function () {
      assert.strictEqual(parseMessage("not a log line"), null);
    });
  });

  describe("topicRegex", function () {
    it("matches whole words, ignoring case", function () {
      const re = topicRegex("log");
      assert.ok(re.test("check the LOG"));
      assert.ok(!re.test("my blog post"));
    });

    it("matches phrases across any spacing", function () {
      assert.ok(topicRegex("ollama setup").test("the ollama   setup guide"));
    });

    it("treats regex characters as plain text", function () {
      assert.ok(topicRegex("c++").test("we use c++ here"));
      assert.ok(!topicRegex("c++").test("we use c here"));
      // Would hang or throw if passed to RegExp unescaped
      assert.doesNotThrow(() => topicRegex("(a+)+$").test("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"));
    });

    it("returns null for an empty topic", function () {
      assert.strictEqual(topicRegex("   "), null);
    });
  });

  describe("searchText", function () {
    it("counts matching messages and skips bot messages", function () {
      const result = searchText(LOG, "ollama");
      assert.strictEqual(result.hits, 2); // noah x2; the [BOT] summary is ignored
      assert.deepStrictEqual(result.sample, { author: "noah", text: "anyone got Ollama running in codespaces?" });
    });

    it("searches continuation lines too", function () {
      assert.strictEqual(searchText(LOG, "localhost").hits, 1);
    });

    it("doesn't match author or channel names", function () {
      assert.strictEqual(searchText(LOG, "vicky"), null);
      assert.strictEqual(searchText(LOG, "general"), null);
    });

    it("returns null when nothing matches", function () {
      assert.strictEqual(searchText(LOG, "deadline"), null);
    });
  });
});