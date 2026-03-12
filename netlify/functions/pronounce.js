export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { word, transcript } = await req.json();

    const prompt = `A German C1 student tried to pronounce the word "${word}". The speech recognition heard: "${transcript}". Give short, encouraging pronunciation feedback in English. If it's close enough, say so positively. If not, give 1-2 specific tips on how to pronounce "${word}" correctly. Keep it under 3 sentences. Be encouraging and specific.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) return new Response(JSON.stringify(data), { status: response.status, headers: { "Content-Type": "application/json" } });

    const feedback = data.content.map(i => i.text || "").join("").trim();
    return new Response(JSON.stringify({ feedback }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

export const config = { path: "/api/pronounce" };
