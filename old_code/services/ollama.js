import axios from "axios";

// Sends messages to Qwen (through Ollama) and returns
// { summary, topics, includedCount } in one request.

// Qwen on a Codespace CPU reads roughly 25-30 tokens/second, so long transcripts
// get slow fast. ~6000 characters is about 1-1.5 minutes. Raise it if you have a GPU.
export const MAX_TRANSCRIPT_CHARS = 6000;

function formatTime(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Keep the most recent lines that fit under the character limit.
export function buildTranscript(messages, maxChars = MAX_TRANSCRIPT_CHARS) {
  const lines = [];
  let size = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const line = `[${formatTime(m.timestamp)}] ${m.author}: ${m.content.replace(/\s+/g, " ")}`;
    if (size + line.length + 1 > maxChars && lines.length) break;
    lines.unshift(line);
    size += line.length + 1;
  }

  return { transcript: lines.join("\n"), includedCount: lines.length };
}

export function parseSummaryResponse(raw) {
  let result;
  try {
    result = JSON.parse(raw);
  } catch {
    throw new Error(`Qwen did not return valid JSON: ${String(raw).slice(0, 200)}`);
  }

  const summary = typeof result.summary === "string" ? result.summary.trim() : "";
  const topics = Array.isArray(result.topics)
    ? result.topics.filter((t) => typeof t === "string").map((t) => t.trim()).filter(Boolean).slice(0, 3)
    : [];

  if (!summary) throw new Error("Qwen returned no summary.");
  return { summary, topics };
}

export async function summarizeMessages(messages) {
  const { transcript, includedCount } = buildTranscript(messages);

  const response = await axios.post(
    process.env.OLLAMA_URL,
    {
      model: process.env.OLLAMA_MODEL,
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content: `You summarize Discord conversations.

Read the conversation and return ONLY valid JSON in this exact format:
{"summary": "2-4 sentences describing what was discussed and any decisions made", "topics": ["Topic 1", "Topic 2", "Topic 3"]}

Rules:
- Only use facts from the conversation. Do not invent details.
- Refer to people by the names shown.
- "topics" has 1 to 3 short topic names. Combine closely related subjects.
- Ignore greetings and meaningless chatter.`,
        },
        { role: "user", content: transcript },
      ],
      options: { temperature: 0.2 },
    },
    { timeout: 180000 }
  );

  const raw = response.data?.message?.content;
  if (!raw) throw new Error("Ollama returned an empty response.");

  return { ...parseSummaryResponse(raw), includedCount };
}