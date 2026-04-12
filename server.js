const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Ти — експерт-дієтолог. Аналізуй їжу, рецепти або зображення і повертай ВИКЛЮЧНО JSON без жодного тексту.
Формат:
{"name":"Назва страви","emoji":"емодзі","calories":число,"protein":число,"fat":число,"carbs":число,"portion":"опис порції","tip":"короткий коментар для схуднення"}`;

app.get("/", (req, res) => res.json({ status: "ok" }));

app.post("/analyze", async (req, res) => {
  try {
    const { text, image } = req.body;
    if (!text && !image) return res.status(400).json({ error: "Потрібен text або image" });

    const content = [];
    if (image) {
      content.push({ type: "image", source: { type: "base64", media_type: image.type, data: image.data } });
    }
    content.push({ type: "text", text: text || "Це рецепт або фото страви. Розрахуй КБЖУ на одну порцію. Відповідай ТІЛЬКИ JSON." });

    const msg = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 500,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    const raw = msg.content.filter(b => b.type === "text").map(b => b.text).join("");
    const match = raw.replace(/```json|```/gi, "").match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "Неочікувана відповідь від ШІ" });

    res.json(JSON.parse(match[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
