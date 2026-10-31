import { expect } from "chai";
import identifyTopics, {
  analyzeConversation,
  parseConversationAnalysis,
} from "../src/helpers/identifyTopics";

describe("conversation analysis", () => {
  it("returns an empty analysis when there are no messages", async () => {
    expect(await analyzeConversation([])).to.deep.equal({
      topics: [],
      deadlines: [],
    });
    expect(await identifyTopics([])).to.deep.equal([]);
  });

  it("normalizes topics and task deadlines", () => {
    const analysis = parseConversationAnalysis(
      JSON.stringify({
        topics: [" Group project ", "", 42],
        deadlines: [
          {
            task: " Submit report ",
            dueDate: " 2026-11-02 ",
            sourceText: " report is due Monday ",
          },
          { task: "Missing date", dueDate: "" },
          null,
        ],
      })
    );

    expect(analysis).to.deep.equal({
      topics: ["Group project"],
      deadlines: [
        {
          task: "Submit report",
          dueDate: "2026-11-02",
          sourceText: "report is due Monday",
        },
      ],
    });
  });

  it("rejects responses without both arrays", () => {
    expect(() => parseConversationAnalysis('{"topics":[]}')).to.throw(
      "invalid conversation analysis"
    );
  });

  it("limits the number of returned topics and deadlines", () => {
    const analysis = parseConversationAnalysis({
      topics: ["One", "Two", "Three", "Four"],
      deadlines: Array.from({ length: 12 }, (_, index) => ({
        task: `Task ${index}`,
        dueDate: `2026-11-${String(index + 1).padStart(2, "0")}`,
      })),
    });

    expect(analysis.topics).to.have.length(3);
    expect(analysis.deadlines).to.have.length(10);
  });
});
