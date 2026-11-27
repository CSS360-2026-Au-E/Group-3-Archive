const assert = require("assert");

const { LogInputError } = require("../src/logsys/logStore");
const { SummaryError } = require("../src/ollama/summarizer");
const { formatSlashError } = require("../src/slashCommands");

describe("Slash command error messages", function () {
  it("shows invalid input without a generic failure", function () {
    const message = formatSlashError(
      new LogInputError("Invalid date. Use YYYY-MM-DD, today, or yesterday."),
      "log"
    );

    assert.match(message, /Invalid date/);
  });

  it("shows a retryable summary-service message", function () {
    const message = formatSlashError(
      new SummaryError("The summary service is unavailable."),
      "summary"
    );

    assert.match(message, /unavailable/i);
    assert.match(message, /Try again/);
  });

  it("does not expose an expired Discord interaction", function () {
    const message = formatSlashError({ code: 10062 }, "summary");
    assert.strictEqual(message, null);
  });

  it("shows actionable file permission guidance", function () {
    const message = formatSlashError({ code: "EACCES" }, "log");

    assert.match(message, /permission/i);
    assert.match(message, /administrator/i);
  });

  it("shows actionable storage guidance", function () {
    const message = formatSlashError({ code: "ENOSPC" }, "clearlog");

    assert.match(message, /storage is full/i);
  });
});
