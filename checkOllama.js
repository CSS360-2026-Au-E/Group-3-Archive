require("dotenv").config();
const axios = require("axios");

(async () => {
  const url = process.env.OLLAMA_URL;
  const model = process.env.OLLAMA_MODEL;
  console.log(`Testing ${model} at ${url} ...`);
  const start = Date.now();

  try {
    const res = await axios.post(url, {
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: 'Return ONLY JSON: {"summary": string, "topics": string[]}' },
        { role: "user", content: "Noah: when is the deadline?\nVic: next Thursday, let's split up the bot work." },
      ],
      options: { temperature: 0.2 },
    }, { timeout: 120000 });

    const content = res.data?.message?.content;
    console.log(`Response in ${((Date.now() - start) / 1000).toFixed(1)}s:`);
    console.log(JSON.parse(content));
  } catch (err) {
    if (err.code === "ECONNREFUSED") console.error("Can't reach Ollama. Is it running at that URL?");
    else if (err.response?.status === 404) console.error("404: model not pulled, or wrong URL path (should end in /api/chat).");
    else if (err.code === "ECONNABORTED") console.error("Timed out. Model may still be loading; try again.");
    else console.error("Failed:", err.message);
  }
})();