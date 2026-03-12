export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const { word, transcript } = await req.json();

    const prompt = `Ein Deutschlernender auf C1-Niveau hat versucht, das Wort/den Ausdruck "${word}" auszusprechen. Die Spracherkennung hat Folgendes gehört: "${transcript}".

Antworte NUR mit einem JSON-Objekt (kein Markdown, keine Backticks):
{
  "score": <Zahl 0-100, wie gut die Aussprache war>,
  "feedback": "<2-3 Sätze auf Deutsch: ermutigend, konkret, mit Tipps falls nötig>",
  "highlights": [
    {"token": "<jedes Wort/Silbe aus '${word}'>", "quality": "<gut|mittel|schlecht>"}
  ]
}

Für highlights: teile "${word}" in sinnvolle Teile auf (Wörter oder wichtige Silben) und bewerte jeden Teil basierend darauf, ob die Spracherkennung ihn korrekt erkannt hat.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type":"application/json", "x-api-key":process.env.ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01" },
      body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:600, messages:[{ role:"user", content:prompt }] })
    });

    const data = await response.json();
    if (!response.ok) return new Response(JSON.stringify(data), { status:response.status, headers:{"Content-Type":"application/json"} });

    const text = data.content.map(i => i.text||"").join("").trim();
    const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" }
    });
  } catch(e) {
    return new Response(JSON.stringify({ error:e.message }), { status:500, headers:{"Content-Type":"application/json"} });
  }
};

export const config = { path: "/api/pronounce" };
