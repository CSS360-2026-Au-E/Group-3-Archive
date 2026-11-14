// Unit tests for src/logsys/logUtils.js
//
// These helpers decide which date a command means and which file a log is
// saved in, so the logger and the slash commands depend on them being right.
//
// Run just this file:   npx mocha -r esbuild-runner/register tests/logUtils.spec.js --exit
// Run every test:       npm test

import { expect } from "chai";
import {
  parseDate,
  getDateRange,
  safeName,
  dateStamp,
  DateRangeError,
} from "../src/logsys/logUtils";

// ---------------------------------------------------------------------------
// Test 1: parseDate turns what a user types into a "YYYY-MM-DD" date
// ---------------------------------------------------------------------------
describe("parseDate", () => {
  it("accepts a valid YYYY-MM-DD date", () => {
    expect(parseDate("2026-11-13")).to.equal("2026-11-13");
  });

  it("understands 'today', ignoring case and extra spaces", () => {
    const today = dateStamp(new Date());
    expect(parseDate("today")).to.equal(today);
    expect(parseDate("  TODAY  ")).to.equal(today);
  });

  it("rejects dates that don't exist", () => {
    expect(parseDate("0000-00-00")).to.be.null; // no month 0
    expect(parseDate("2027-13-40")).to.be.null; // no month 13 or day 40
    expect(parseDate("2026-02-30")).to.be.null; // February has no 30th
  });

  it("rejects text in the wrong format", () => {
    expect(parseDate("11/13/2026")).to.be.null;
    expect(parseDate("2026-1-5")).to.be.null;
    expect(parseDate("")).to.be.null;
    expect(parseDate(undefined)).to.be.null;
  });
});

// ---------------------------------------------------------------------------
// Test 2: getDateRange lists every day in a range, up to 7 days
// ---------------------------------------------------------------------------
describe("getDateRange", () => {
  it("lists every day from start to end, including both", () => {
    expect(getDateRange("2026-11-12", "2026-11-14")).to.deep.equal([
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
    ]);
  });

  it("returns a single day when start and end are the same", () => {
    expect(getDateRange("2026-11-13", "2026-11-13")).to.deep.equal(["2026-11-13"]);
  });

  it("continues correctly across the end of a month and a year", () => {
    expect(getDateRange("2026-12-30", "2027-01-02")).to.deep.equal([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("allows a full 7 days", () => {
    expect(getDateRange("2026-11-01", "2026-11-07")).to.have.lengthOf(7);
  });

  it("rejects ranges longer than 7 days", () => {
    expect(() => getDateRange("2026-11-01", "2026-11-08")).to.throw(DateRangeError, "limited to 7 days");
  });

  it("rejects an end date before the start date", () => {
    expect(() => getDateRange("2026-11-13", "2026-11-12")).to.throw(DateRangeError, "before start date");
  });

  it("rejects an invalid start or end date", () => {
    expect(() => getDateRange("2027-13-40", "2027-12-01")).to.throw(DateRangeError, "Invalid start date");
    expect(() => getDateRange("2026-11-01", "not a date")).to.throw(DateRangeError, "Invalid end date");
  });
});

// ---------------------------------------------------------------------------
// Test 3: safeName turns a server or channel name into a safe folder name
// ---------------------------------------------------------------------------
describe("safeName", () => {
  it("keeps normal channel names unchanged", () => {
    expect(safeName("general")).to.equal("general");
    expect(safeName("project-team")).to.equal("project-team");
  });

  it("replaces characters that folder names can't contain", () => {
    expect(safeName('a/b\\c:d*e?f"g<h>i|j')).to.equal("a_b_c_d_e_f_g_h_i_j");
  });

  it("replaces invisible control characters such as line breaks", () => {
    expect(safeName("line\nbreak")).to.equal("line_break");
  });

  it("trims spaces at the start and end", () => {
    expect(safeName("  general  ")).to.equal("general");
  });

  it("falls back to 'unknown' when there is no name", () => {
    expect(safeName("")).to.equal("unknown");
    expect(safeName(null)).to.equal("unknown");
    expect(safeName("   ")).to.equal("unknown");
  });
});
