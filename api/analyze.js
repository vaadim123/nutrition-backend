// їж. v1.0
const https = require("https");

const SYSTEM = `Ти експерт-дієтолог. Аналізуй їжу, рецепти або зображення і повертай ВИКЛЮЧНО JSON без жодного тексту.
Формат: {"name":"Назва","emoji":"емодзі","calories":число,"protein":число,"fat":число,"carbs":число,"portion":"опис порції","tip":"коментар для схуднення"}`;

function geminiRequest(apiKey, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let result = "";
      res.on("data", chunk => result += chunk);
      res.on("end", () => resolve(JSON.parse(result)));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  // Health check
  if (req.method === "GET") {
    res.status(200).json({ status: "ok", version: "v1.0" });
    return;
  }

  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  // Підтримка обох назв змінної
  const apiKey = process.env.GEMINI_API_KEY || process.env.Gemini_API_Key;
  if (!apiKey) { res.status(500).json({ error: "GEMINI_API_KEY not set" }); return; }

  try {
    const { text, image } = req.body;
    if (!text && !image) { res.status(400).json({ error: "Потрібен text або image" }); return; }

    const parts = [];
    if (image) {
      parts.push({ inline_data: { mime_type: image.type, data: image.data } });
    }
    parts.push({
      text: text || "Це рецепт або фото страви. Розрахуй КБЖУ на одну порцію. Відповідай ТІЛЬКИ JSON."
    });

    const data = await geminiRequest(apiKey, {
      system_instruction: { parts: [{ text: SYSTEM }] },
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: 500, temperature: 0.1 }
    });

    if (data.error) { res.status(500).json({ error: data.error.message }); return; }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const match = raw.replace(/```json|```/gi, "").match(/\{[\s\S]*\}/);
    if (!match) { res.status(500).json({ error: "Неочікувана відповідь: " + raw.slice(0, 100) }); return; }

    res.status(200).json(JSON.parse(match[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
