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
    process.env.OLLAMA_URL,
    {
      model: process.env.OLLAMA_MODEL,
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content: `You are a Discord conversation topic identifier.

Read the conversation carefully and identify its main discussion topics.

Return between 1 and 3 topics when meaningful topics exist.
Combine closely related subjects into one topic.
Ignore greetings, jokes, and meaningless chatter.
Do not return an empty array if the conversation contains clear topics.

Return ONLY valid JSON in this exact format:
{"topics":["Math homework","Minecraft gaming","Group project planning"]}`,
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

  console.log("Raw Qwen response:", response.data.message.content);

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
