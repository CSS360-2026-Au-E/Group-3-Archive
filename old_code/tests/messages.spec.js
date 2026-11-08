import { expect } from "chai";
import { fetchMessages } from "../src/services/messages";

// Builds a fake Discord message. `minutesAgo` sets its timestamp.
let nextId = 1;
function msg(content, minutesAgo, { bot = false, name = "Noah" } = {}) {
  const createdTimestamp = Date.now() - minutesAgo * 60 * 1000;
  return {
    id: String(nextId++),
    content,
    author: { bot, username: name },
    member: { displayName: name },
    createdTimestamp,
    createdAt: new Date(createdTimestamp),
  };
}

// A fake channel holding `all` (newest first, like Discord) that pages like Discord.
function fakeChannel(all) {
  const requests = [];
  return {
    requests,
    messages: {
      fetch: async ({ limit, before }) => {
        requests.push({ limit, before });
        const start = before ? all.findIndex((m) => m.id === before) + 1 : 0;
        const page = all.slice(start, start + limit);
        return new Map(page.map((m) => [m.id, m]));
      },
    },
  };
}

describe("fetchMessages", () => {
  it("returns the newest N human messages, oldest first, skipping bots and empty ones", async () => {
    const channel = fakeChannel([
      msg("newest", 1),
      msg("bot reply", 2, { bot: true }),
      msg("   ", 3),
      msg("middle", 4, { name: "Vic" }),
      msg("oldest", 5),
    ]);
    const result = await fetchMessages(channel, { count: 2 });
    expect(result.map((m) => m.content)).to.deep.equal(["middle", "newest"]);
    expect(result[0]).to.include({ author: "Vic" });
    expect(result[0].timestamp).to.be.instanceOf(Date);
  });

  it("returns only messages inside the time range", async () => {
    const channel = fakeChannel([msg("10 min ago", 10), msg("50 min ago", 50), msg("2 hours ago", 120)]);
    const result = await fetchMessages(channel, { sinceMs: 60 * 60 * 1000 });
    expect(result.map((m) => m.content)).to.deep.equal(["50 min ago", "10 min ago"]);
  });

  it("pages back through history for long ranges", async () => {
    // 250 messages, one per minute, all within the last 5 hours
    const all = Array.from({ length: 250 }, (_, i) => msg(`m${i}`, i));
    const channel = fakeChannel(all);
    const result = await fetchMessages(channel, { sinceMs: 5 * 60 * 60 * 1000 });
    expect(result).to.have.length(250);
    expect(channel.requests).to.have.length(3);
    expect(result[0].content).to.equal("m249");
  });
});