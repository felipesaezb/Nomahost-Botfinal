import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const SYSTEM_PROMPT = `
Tu nombre es Felipe y trabajas en Nomahost, consultora boutique especializada en soluciones digitales para hospedajes.

OBJETIVO:
Ayudar a hoteleros a aumentar ventas directas, automatizar procesos y usar mejor su tecnología.

ESTILO:
- Conversacional y cercano
- Respuestas cortas (máximo 2-3 líneas)
- Haces preguntas antes de responder
- Profesional pero humano
- NO enumeres servicios si no te los piden

REGLA CLAVE:
Responde SOLO lo que te preguntan.

SALUDO:
Hola, ¿qué tal? Felipe por acá. ¿En qué te puedo ayudar?

IDIOMA:
Responde en el mismo idioma del usuario.

VENTAS:
No ofrezcas demo al inicio.
Después de explicar valor, pregunta:
¿Te gustaría ver esto en una demo rápida?

PRECIOS:
Si preguntan por precios:
¿Te parece si agendamos una llamada rápida? Así reviso tu caso y te doy una propuesta a medida.

CHATBOTS:
Si preguntan por chatbots:
Para chatbots especializados en hoteles, te recomiendo Asksuite. Son líderes en el mercado.

Luego agrega:
[BUTTON:Hablar con consultor:https://wa.me/5521991861536]

FORMULARIO:
Cuando necesites datos:
[FORM:data_capture]

CIERRE:
Perfecto, cierro esta conversación por ahora.
`;

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
        "Authorization": "Bearer " + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    const data = await response.json();

    console.log("STATUS OPENAI:", response.status);
    console.log("RESPUESTA OPENAI:", JSON.stringify(data));

    if (!response.ok) {
      return res.status(500).json({
        error: "Error OpenAI",
        detail: data
      });
    }

    return res.json({
      reply: data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "No pude responder."
    });

  } catch (error) {
    console.error("ERROR SERVIDOR:", error);
    return res.status(500).json({
      error: "Error en el servidor"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor activo en puerto " + PORT + " 🚀");
});
