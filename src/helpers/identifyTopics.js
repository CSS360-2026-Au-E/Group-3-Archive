import axios from "axios";

export default async function identifyTopics(messages) {
  if (!messages?.length) return [];

  const conversation = messages
    .map((message) => {
      const username = message.author?.username ?? "Unknown";
      return `${username}: ${message.content ?? ""}`;
    })
    .filter((line) => !line.endsWith(": "))
    .join("\n")
    .slice(0, 12000);

  const response = await axios.post(
    process.env.OLLAMA_URL || "http://localhost:11434/api/chat",
    {
      model: process.env.OLLAMA_MODEL || "qwen2.5:3b",
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content: `Identify up to three main discussion topics in a Discord conversation.
Return JSON in this exact format: {"topics":["topic one","topic two"]}.
Use short descriptive topic names.
Group related messages together.
Ignore greetings and meaningless chatter.
Do not invent topics.
Return {"topics":[]} if there are no meaningful topics.`,
        },
        {
          role: "user",
          content: conversation,
        },
      ],
      options: {
        temperature: 0.2,
      },
    },
    { timeout: 60000 }
  );

  const result = JSON.parse(response.data.message.content);

  if (!Array.isArray(result.topics)) {
    throw new Error("Qwen returned an invalid topics array.");
  }

  return result.topics
    .filter((topic) => typeof topic === "string")
    .map((topic) => topic.trim())
    .filter(Boolean)
    .slice(0, 3);
}
