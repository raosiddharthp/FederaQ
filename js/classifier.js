import { PROXY_URL, MODEL } from "./config.js";

const SYSTEM_PROMPT = `
You are a query intent classifier for FederaQ.
Return ONLY valid JSON — no preamble, no markdown, no backticks.
{
  "intent": "cross-system" | "live-status" | "inventory" | "pipeline" | "single-connector",
  "connectors": array of "CRM" | "ERP" | "Ticketing",
  "confidence": float 0-1,
  "format": "TABLE" | "CHART" | "CARD" | "PROSE",
  "format_confidence": float 0-1,
  "sensitivity": "high" | "low"
}
Rules:
- confidence < 0.60 → connectors: ["CRM","ERP","Ticketing"]
- format_confidence < 0.70 → omit format field
- cross-system queries involve ≥2 connectors
- inventory → ERP, pipeline → CRM, live-status → Ticketing
`;

export async function classifyIntent(query) {
  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.0,
        max_tokens: 300,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: query }
        ]
      })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || "{}";
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { intent: "cross-system", connectors: ["CRM","ERP","Ticketing"], confidence: 0.5, format: "TABLE", format_confidence: 0.8, sensitivity: "low" };
  }
}
