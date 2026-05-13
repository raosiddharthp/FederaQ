import { PROXY_URL, MODEL } from "./config.js";

export async function synthesise(query, classifierResult, connectorResults) {
  const context = Object.entries(connectorResults)
    .map(([src, r]) => `[${src} · fetched ${Math.round((Date.now()-r.fetched_at)/1000)}s ago]\n${JSON.stringify(r.data, null, 2)}`)
    .join("\n\n");

  const format = classifierResult.format || (Object.keys(connectorResults).length > 1 ? "TABLE" : "PROSE");

  const prompt = `You are FederaQ, a federated query synthesis engine for enterprise operational data.
Answer the user query using ONLY the connector data below. Be concise and grounded.
Cite each source. Do not hallucinate data not present below.
Preferred output format: ${format}

CONNECTOR DATA:
${context}

USER QUERY: ${query}`;

  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Synthesis failed.";
}
