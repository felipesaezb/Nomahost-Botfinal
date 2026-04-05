import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `Pega aquí EXACTAMENTE tu prompt completo (el que ya tienes)`;

// 🔥 TEST ROUTE
app.get("/", (req, res) => {
  res.send("Servidor activo 🚀");
});

// 🔥 CHAT ROUTE
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    // 🔥 VALIDACIÓN CLAVE
    if (!data.choices) {
      console.error("ERROR OPENAI:", data);
      return res.status(500).json({ reply: "Error interno del bot" });
    }

    res.json({ reply: data.choices[0].message.content });

  } catch (error) {
    console.error("ERROR SERVER:", error);
    res.status(500).json({ reply: "Error conectando con el bot" });
  }
});

app.listen(PORT, () => console.log("running on port " + PORT));
