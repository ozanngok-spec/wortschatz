export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { word } = await req.json();

    const prompt = `You are a German language teacher helping a C1 level student. The user typed: "${word}". First, correct any spelling mistakes and return the properly formatted German word or expression. Return ONLY a JSON object (no markdown, no backticks, no explanation) in this exact format: {"word":"corrected and properly formatted German word or expression","translation":"English translation","type":"Nomen / Verb / Ausdruck / Adjektiv / Adverb / etc","level":"A1 / A2 / B1 / B2 / C1 / C2","explanation":"Kurze Erklaerung auf Deutsch in 1-2 Saetzen: Was bedeutet dieses Wort und wie wird es verwendet?","sentences":[{"german":"Erster Beispielsatz auf Deutsch","english":"English translation"},{"german":"Zweiter Beispielsatz in einem anderen Kontext","english":"English translation"},{"german":"Dritter Beispielsatz","english":"English translation"}]}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const text = data.content.map(i => i.text || "").join("");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config = { path: "/api/claude" };
