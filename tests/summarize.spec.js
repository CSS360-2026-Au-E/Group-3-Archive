import { expect } from "chai";
import summarize from "../src/commands/summarize";

// A fake Discord interaction that records what the command does.
function fakeInteraction(count = null) {
  const calls = [];
  return {
    calls,
    channel: {},
    options: { getInteger: () => count },
    deferReply: async () => calls.push(["defer"]),
    editReply: async (msg) => calls.push(["edit", msg]),
  };
}

const sampleMessages = (n) =>
  Array.from({ length: n }, (_, i) => ({ content: `msg ${i}`, author: "a", timestamp: new Date() }));

describe("/summarize", () => {
  it("is named summarize and has an optional count option", () => {
    const json = summarize.data.toJSON();
    expect(json.name).to.equal("summarize");
    expect(json.options[0].name).to.equal("count");
    expect(json.options[0].required).to.not.equal(true);
  });

  it("defaults to 20 messages and defers before doing work", async () => {
    let requested;
    const i = fakeInteraction(null);
    await summarize.execute(i, {
      fetchRecentMessages: async (_c, n) => { requested = n; return sampleMessages(3); },
      summarizeMessages: async () => ({ summary: "s", topics: ["t"] }),
      buildSummaryReply: (r) => ({ content: `${r.messageCount}` }),
    });
    expect(requested).to.equal(20);
    expect(i.calls[0][0]).to.equal("defer");
    expect(i.calls[1]).to.deep.equal(["edit", { content: "3" }]);
  });

  it("uses the count the user gives", async () => {
    let requested;
    await summarize.execute(fakeInteraction(5), {
      fetchRecentMessages: async (_c, n) => { requested = n; return sampleMessages(5); },
      summarizeMessages: async () => ({ summary: "s", topics: [] }),
      buildSummaryReply: () => ({ content: "ok" }),
    });
    expect(requested).to.equal(5);
  });

  it("replies with a friendly error if the AI call fails", async () => {
    const i = fakeInteraction();
    const origError = console.error; console.error = () => {};
    await summarize.execute(i, {
      fetchRecentMessages: async () => sampleMessages(3),
      summarizeMessages: async () => { throw new Error("Ollama down"); },
      buildSummaryReply: () => ({}),
    });
    console.error = origError;
    expect(i.calls[1][1]).to.include("couldn't summarize");
  });

  it("handles a channel with no messages", async () => {
    const i = fakeInteraction();
    await summarize.execute(i, {
      fetchRecentMessages: async () => [],
      summarizeMessages: async () => { throw new Error("should not be called"); },
      buildSummaryReply: () => ({}),
    });
    expect(i.calls[1][1]).to.include("no recent messages");
  });
});