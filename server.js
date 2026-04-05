import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY;

// 👉 Ruta para probar si el server está vivo
app.get("/", (req, res) => {
  res.send("Servidor activo 🚀");
});

// 👉 Ruta del chatbot
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
          {
            role: "system",
            content: "Eres Felipe de Nomahost, experto en hotelería y ventas."
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await response.json();

    const reply = data.choices?.[0]?.message?.content || "Error del bot";

    res.json({ reply });

  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({ reply: "Error del servidor" });
  }
});

// 👉 Levantar servidor
app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});
