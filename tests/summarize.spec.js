import { expect } from "chai";
import summarize from "../src/commands/summarize";

// A fake Discord interaction that records what the command does.
function fakeInteraction({ count = null, period = null } = {}) {
  const calls = [];
  return {
    calls,
    channel: {},
    options: { getInteger: () => count, getString: () => period },
    reply: async (msg) => calls.push(["reply", msg]),
    deferReply: async () => calls.push(["defer"]),
    editReply: async (msg) => calls.push(["edit", msg]),
  };
}

const sampleMessages = (n) =>
  Array.from({ length: n }, (_, i) => ({ content: `msg ${i}`, author: "a", timestamp: new Date() }));

const okDeps = (overrides = {}) => ({
  fetchMessages: async () => sampleMessages(3),
  summarizeMessages: async () => ({ summary: "s", topics: ["t"] }),
  buildSummaryReply: (r) => ({ content: `${r.messageCount}|${r.rangeLabel ?? ""}` }),
  ...overrides,
});

describe("/summarize", () => {
  it("has optional count and period options", () => {
    const json = summarize.data.toJSON();
    expect(json.name).to.equal("summarize");
    expect(json.options.map((o) => o.name)).to.deep.equal(["count", "period"]);
    expect(json.options.every((o) => o.required !== true)).to.equal(true);
  });

  it("defaults to 20 messages and defers before doing work", async () => {
    let requested;
    const i = fakeInteraction();
    await summarize.execute(i, okDeps({
      fetchMessages: async (_c, opts) => { requested = opts; return sampleMessages(3); },
    }));
    expect(requested).to.deep.equal({ count: 20 });
    expect(i.calls[0][0]).to.equal("defer");
    expect(i.calls[1]).to.deep.equal(["edit", { content: "3|" }]);
  });

  it("uses the count the user gives", async () => {
    let requested;
    await summarize.execute(fakeInteraction({ count: 5 }), okDeps({
      fetchMessages: async (_c, opts) => { requested = opts; return sampleMessages(5); },
    }));
    expect(requested).to.deep.equal({ count: 5 });
  });

  it("fetches by time when a period is given", async () => {
    let requested;
    const i = fakeInteraction({ period: "last hour" });
    await summarize.execute(i, okDeps({
      fetchMessages: async (_c, opts) => { requested = opts; return sampleMessages(4); },
    }));
    expect(requested).to.deep.equal({ sinceMs: 60 * 60 * 1000 });
    expect(i.calls[1]).to.deep.equal(["edit", { content: "4|the last hour" }]);
  });

  it("rejects a period it can't understand without deferring", async () => {
    const i = fakeInteraction({ period: "a fortnight-ish" });
    await summarize.execute(i, okDeps({
      fetchMessages: async () => { throw new Error("should not be called"); },
    }));
    expect(i.calls).to.have.length(1);
    expect(i.calls[0][0]).to.equal("reply");
    expect(i.calls[0][1].ephemeral).to.equal(true);
  });

  it("replies with a friendly error if the AI call fails", async () => {
    const i = fakeInteraction();
    const origError = console.error; console.error = () => {};
    await summarize.execute(i, okDeps({
      summarizeMessages: async () => { throw new Error("Ollama down"); },
    }));
    console.error = origError;
    expect(i.calls[1][1]).to.include("couldn't summarize");
  });

  it("handles a channel with no messages", async () => {
    const i = fakeInteraction();
    await summarize.execute(i, okDeps({ fetchMessages: async () => [] }));
    expect(i.calls[1][1]).to.include("no recent messages");
  });

  it("names the time span when a period has no messages", async () => {
    const i = fakeInteraction({ period: "2 days" });
    await summarize.execute(i, okDeps({ fetchMessages: async () => [] }));
    expect(i.calls[1][1]).to.include("the last 2 days");
  });
});