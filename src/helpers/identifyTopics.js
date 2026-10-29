import axios from "axios";

export default async function identifyTopics(messages) {
  if (!messages || messages.length === 0) {
    return [];
  }

  const conversation = messages
    .map((message) => {
      const username =
        message.author?.username ?? "Unknown";

      return `${username}: ${message.content}`;
    })
    .join("\n");

  const prompt = `
Identify up to three main discussion topics in this Discord conversation.

Rules:
- Use short, descriptive topic names.
- Group related messages together.
- Prioritize important and frequently discussed subjects.
- Ignore greetings and meaningless chatter.
- Do not invent topics.
- Return an empty array if no meaningful topics exist.

Return valid JSON only in this format:
{
  "topics": ["Topic 1", "Topic 2", "Topic 3"]
}

Conversation:
${conversation}
`;

  const response = await axios.post(
    process.env.QWEN_API_URL,
    {
      model: process.env.QWEN_MODEL || "qwen-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      response_format: {
        type: "json_object",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.QWEN_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const content = response.data.choices[0].message.content;
  const result = JSON.parse(content);

  if (
    !result ||
    !Array.isArray(result.topics) ||
    !result.topics.every(
      (topic) => typeof topic === "string"
    )
  ) {
    throw new Error("Qwen returned an invalid topics array.");
  }

  return result.topics
    .map((topic) => topic.trim())
    .filter(Boolean)
    .slice(0, 3);
}

