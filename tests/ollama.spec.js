import { expect } from "chai";
import { buildTranscript, parseSummaryResponse } from "../src/services/ollama";

const m = (author, content) => ({ author, content, timestamp: new Date(2026, 10, 5, 16, 20) });

describe("ollama helpers", () => {
  it("formats messages as a timestamped transcript", () => {
    const { transcript, includedCount } = buildTranscript([m("Noah", "hi"), m("Vic", "hey\nthere")]);
    expect(transcript).to.equal("[11-05 16:20] Noah: hi\n[11-05 16:20] Vic: hey there");
    expect(includedCount).to.equal(2);
  });

  it("keeps the most recent messages when the transcript is too long", () => {
    const messages = Array.from({ length: 50 }, (_, i) => m("Noah", `message number ${i}`));
    const { transcript, includedCount } = buildTranscript(messages, 200);
    expect(includedCount).to.be.below(50);
    expect(transcript).to.include("message number 49");
    expect(transcript).to.not.include("message number 0\n");
  });

  it("parses a good response and cleans up topics", () => {
    const raw = JSON.stringify({ summary: " Talked. ", topics: ["A", " B ", 3, "", "C", "D"] });
    expect(parseSummaryResponse(raw)).to.deep.equal({ summary: "Talked.", topics: ["A", "B", "C"] });
  });

  it("throws a clear error on bad JSON or a missing summary", () => {
    expect(() => parseSummaryResponse("not json")).to.throw("valid JSON");
    expect(() => parseSummaryResponse('{"topics": []}')).to.throw("no summary");
  });
});