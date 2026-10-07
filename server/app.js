const express = require("express");
require("dotenv").config();

const app = express();
app.use(express.json({ limit: "96kb" }));

const SYSTEM_PROMPT = `You are Med Alert, a cautious emergency first-response information assistant. Follow every rule:
- Do not diagnose diseases with certainty.
- Do not prescribe medication or dosage.
- Do not replace doctors or emergency services.
- If symptoms may indicate a life-threatening emergency, tell the user to contact local emergency services immediately. Say this first and clearly, and explicitly tell the user not to wait for your response. Do not delay care with questions.
- Provide general first-response information only.
- Ask only essential clarification questions.
- Keep emergency responses concise and action-focused.
- Never encourage delaying emergency medical care.
- Clearly distinguish general information from professional medical advice.
- Do not claim to contact emergency services or provide location-specific emergency numbers.
- Be calm, direct, and compassionate.`;

function normalizeHistory(history) {
  if (history === undefined) return [];
  if (!Array.isArray(history)) throw new Error("Conversation history must be an array.");
  if (history.length > 8) throw new Error("Conversation history is too long.");
  const normalized = history.map((entry, index) => {
    if (!entry || !["user", "assistant"].includes(entry.role) || typeof entry.text !== "string" || !entry.text.trim() || entry.text.length > 2000) {
      throw new Error("Conversation history contains an invalid message.");
    }
    const expectedRole = index % 2 === 0 ? "user" : "assistant";
    if (entry.role !== expectedRole) throw new Error("Conversation history must alternate between user and assistant messages.");
    return { role: entry.role === "assistant" ? "model" : "user", parts: [{ text: entry.text.trim() }] };
  });
  if (normalized.length % 2 !== 0) throw new Error("Conversation history must end with an assistant response.");
  return normalized;
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/medical-assistant", async (req, res) => {
  const { message, history } = req.body || {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Please enter a message." });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message must be 2,000 characters or fewer." });
  }

  let contents;
  try {
    contents = [...normalizeHistory(history), { role: "user", parts: [{ text: message.trim() }] }];
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({ error: "The AI assistant is not configured. Set GEMINI_API_KEY on the server to enable it." });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(22000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 700 },
      }),
    });
  } catch (error) {
    console.error("Gemini request failed:", error.message);
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(504).json({ error: "The AI service took too long to respond. Please try again, or contact emergency services now if this may be life-threatening." });
    }
    return res.status(502).json({ error: "The AI service could not be reached. Please try again or contact emergency services if this is urgent." });
  }

  if (!upstream.ok) {
    const upstreamError = await upstream.json().catch(() => ({}));
    console.error("Gemini returned an error:", upstream.status, upstreamError.error?.message || "Unknown upstream error");
    return res.status(502).json({ error: "The AI service could not complete this request. Please try again or contact emergency services if this is urgent." });
  }

  const result = await upstream.json().catch(() => null);
  const reply = result?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!reply) {
    console.error("Gemini response did not contain a text reply.");
    return res.status(502).json({ error: "The AI service returned no guidance. Please try again or contact emergency services if this is urgent." });
  }
  return res.json({ reply });
});

app.use((error, _req, res, _next) => {
  if (error.type === "entity.parse.failed") return res.status(400).json({ error: "Request body must be valid JSON." });
  if (error.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
  console.error("Unhandled API error:", error.message);
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

module.exports = app;
