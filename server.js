import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor Nomahost activo 🚀");
});

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: "Falta message" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "Falta OPENAI_API_KEY en Railway" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Eres Felipe, un experto en hotelería, ventas y automatización con Nomahost. Respondes claro, profesional y cercano."
          },
          {
            role: "user",
            content: userMessage
          }
        ]
      })
    });

    const data = await response.json();

    console.log("STATUS OPENAI:", response.status);
    console.log("RESPUESTA OPENAI:", JSON.stringify(data));

    if (!response.ok) {
      return res.status(500).json({
        error: "Error al consultar OpenAI",
        detail: data
      });
    }

    return res.json({
      reply: data.choices?.[0]?.message?.content || "No pude responder."
    });

  } catch (error) {
    console.error("ERROR SERVIDOR:", error);
    return res.status(500).json({
      error: "Error en el servidor",
      detail: String(error)
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT} 🚀`);
});
