import { expect } from "chai";
import parseTimeRange from "../src/helpers/parseTimeRange";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("parseTimeRange", () => {
  const cases = [
    ["last hour", HOUR, "the last hour"],
    ["1 day", DAY, "the last day"],
    ["past 2 days", 2 * DAY, "the last 2 days"],
    ["3h", 3 * HOUR, "the last 3 hours"],
    ["30 min", 30 * MIN, "the last 30 minutes"],
    ["  Last 45 Minutes ", 45 * MIN, "the last 45 minutes"],
    ["1 week", 7 * DAY, "the last week"],
    ["1.5 hours", 1.5 * HOUR, "the last 1.5 hours"],
  ];

  for (const [input, ms, label] of cases) {
    it(`understands "${input}"`, () => {
      expect(parseTimeRange(input)).to.deep.equal({ ms, label });
    });
  }

  for (const input of ["", "yesterday-ish", "0 hours", "2 fortnights", "8 days", "hour 3", null]) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      expect(parseTimeRange(input)).to.equal(null);
    });
  }
});