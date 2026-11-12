import { expect } from "chai";
import { formatDeadlineMessage } from "../src/events/messageCreate";

describe("deadline messages", () => {
  it("formats task deadlines for Discord", () => {
    expect(
      formatDeadlineMessage([
        { task: "Submit report", dueDate: "2026-11-02" },
        { task: "Review slides", dueDate: "tomorrow at 17:00" },
      ])
    ).to.equal(
      "**Detected deadlines**\n" +
        "- **Submit report** — 2026-11-02\n" +
        "- **Review slides** — tomorrow at 17:00"
    );
  });

  it("escapes Discord markdown in model-generated fields", () => {
    expect(
      formatDeadlineMessage([
        { task: "Ping @everyone *now*", dueDate: "<Friday>" },
      ])
    ).to.equal(
      "**Detected deadlines**\n" +
        "- **Ping @everyone \\*now\\*** — \\<Friday\\>"
    );
  });
});
