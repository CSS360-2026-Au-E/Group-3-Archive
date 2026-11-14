
const { describe, it } = require("mocha");
const assert = require("assert");

const {
  dateStamp,
  timeStamp,
  parseDate,
  getDateRange,
} = require("../src/logsys/logUtils");

describe("Log utility unit tests", function () {
  it("formats a date as YYYY-MM-DD", function () {
    const date = new Date(2026, 10, 13);
    assert.strictEqual(dateStamp(date), "2026-11-13");
  });

  it("formats a time as HH:MM:SS", function () {
    const date = new Date(2026, 10, 13, 9, 8, 7);
    assert.strictEqual(timeStamp(date), "09:08:07");
  });

  it("rejects impossible calendar dates", function () {
    assert.strictEqual(parseDate("2026-02-30"), null);
  });

  it("returns every date in a range, including both endpoints", function () {
    const result = getDateRange("2026-11-10", "2026-11-12");

    assert.deepStrictEqual(result, [
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
  });
});
