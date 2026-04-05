import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors({
  origin: "*"
}));

app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;

app.get("/", (req, res) => {
  res.send("Servidor activo 🚀");
});

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    console.log("Mensaje:", message);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres Felipe de Nomahost" },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    res.json({
      reply: data.choices?.[0]?.message?.content || "Error"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Error del servidor" });
  }
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});
