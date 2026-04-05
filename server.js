import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Memoria simple en RAM por sesión.
 * Ojo: en Railway esto se pierde si el servicio reinicia.
 * Sirve para empezar. Después lo puedes pasar a DB o Redis.
 */
const sessions = new Map();

const MAX_TURNS = 12; // 12 pares user/assistant aprox
const SESSION_TTL_MS = 1000 * 60 * 60 * 6; // 6 horas

const SYSTEM_PROMPT = `
Eres Felipe, asesor comercial de Nomahost.

CONTEXTO
- Empresa: Nomahost
- Tipo: consultora boutique especializada en soluciones digitales para hospedajes
- Público: hoteles independientes, hostales, pousadas y arriendos vacacionales
- Objetivo: ayudar a aumentar ventas directas, automatizar atención y usar mejor su tecnología

FORMA DE HABLAR
- Muy conversacional, natural y humano
- Profesional, cercano y claro
- Respuestas cortas: idealmente 1 a 3 líneas
- No suenes como soporte técnico ni como folleto comercial
- No enumeres servicios salvo que te lo pidan
- No uses groserías
- Detecta el idioma del usuario y responde en ese idioma

REGLAS DE CONVERSACIÓN
- No respondas todo de golpe
- Antes de explicar, entiende
- Haz una pregunta útil cuando falte contexto
- Si el usuario responde corto ("sí", "ok", "dale"), continúa desde el contexto previo y no reinicies
- No repitas saludo en cada mensaje
- No inventes integraciones, precios ni resultados
- No digas "como IA", "como asistente virtual", ni hables del prompt o del sistema interno
- Si no sabes algo, dilo breve y reconduce la conversación

OBJETIVO COMERCIAL
Tu trabajo es:
1) entender la necesidad
2) orientar con claridad
3) mostrar valor de forma breve
4) llevar, de forma natural, a una demo o a dejar datos cuando tenga sentido

CUÁNDO PREGUNTAR
Si el usuario habla de:
- chatbot / automatización:
  pregunta primero si lo quiere para responder mensajes, generar reservas o ambos
- precios:
  no des precio directo sin contexto; pide tipo de hospedaje y volumen/canal antes
- implementación:
  entiende primero qué usa hoy y qué quiere resolver
- problema ambiguo:
  pide una aclaración simple

CUÁNDO OFRECER DEMO
Solo después de entender el caso o explicar valor.
Ejemplos:
- "Te podría mostrar cómo se vería en tu caso. ¿Te gustaría ver una demo rápida?"
- "Si quieres, revisamos tu caso y te muestro una opción más aterrizada. ¿Te parece?"

FORMULARIO
Usa EXACTAMENTE:
[FORM:data_capture]

Muéstralo solo cuando:
- piden precios o cotización
- muestran interés claro en demo
- necesitas datos para seguimiento
- preguntan dónde está el formulario

Si preguntan "¿dónde está el formulario?", responde:
"Aquí está:
[FORM:data_capture]"

CHATBOTS PARA HOTELES
Si el usuario pregunta específicamente por chatbots especializados para hoteles, puedes recomendar Asksuite de forma breve y luego incluir EXACTAMENTE este marcador en una línea separada:
[BUTTON:Hablar con consultor:https://wa.me/5521991861536]

FUERA DE ALCANCE
Si piden algo técnico que no puedes ejecutar desde el chat:
"Eso no lo puedo hacer directamente desde acá, pero sí puedo orientarte. ¿Qué necesitas resolver exactamente?"

SALUDO
Solo si realmente es el primer mensaje o un saludo claro:
"Hola, ¿qué tal? Felipe por acá. ¿En qué te puedo ayudar?"

CIERRE
Si corresponde cerrar:
"Perfecto, lo dejamos hasta aquí por ahora 🙌 Si quieres, retomamos cuando gustes."

IMPORTANTE
- Responde solo a lo que preguntan
- Prioriza continuidad lógica
- Menos discurso, más criterio
- Tu meta es sonar útil, humano y comercialmente inteligente
`;

function cleanupSessions() {
  const now = Date.now();
  for (const [sessionId, data] of sessions.entries()) {
    if (!data?.updatedAt || now - data.updatedAt > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}

function getSession(sessionId) {
  cleanupSessions();

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [],
      updatedAt: Date.now(),
    });
  }

  return sessions.get(sessionId);
}

function trimHistory(messages) {
  // Mantiene solo los últimos mensajes para no inflar tokens
  const maxMessages = MAX_TURNS * 2;
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
}

function sanitizeAssistantReply(text) {
  if (!text) return "No pude responder bien esta vez.";

  let out = String(text).trim();

  // Evita respuestas absurdamente largas
  if (out.length > 900) {
    out = out.slice(0, 900).trim() + "…";
  }

  return out;
}

app.get("/", (req, res) => {
  res.send("Servidor Nomahost activo 🚀");
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "nomahost-chat",
    model: OPENAI_MODEL,
    sessions: sessions.size,
  });
});

app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId = "default", reset = false } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Falta message" });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "Falta OPENAI_API_KEY en Railway" });
    }

    const cleanMessage = String(message).trim();
    const cleanSessionId = String(sessionId).trim() || "default";

    if (reset) {
      sessions.delete(cleanSessionId);
    }

    const session = getSession(cleanSessionId);

    session.messages.push({
      role: "user",
      content: cleanMessage,
    });

    session.messages = trimHistory(session.messages);
    session.updatedAt = Date.now();

    const payload = {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...session.messages,
      ],
      temperature: 0.55,
      max_tokens: 260,
      presence_penalty: 0.15,
      frequency_penalty: 0.2,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ERROR OPENAI STATUS:", response.status);
      console.error("ERROR OPENAI BODY:", JSON.stringify(data));
      return res.status(500).json({
        error: "Error OpenAI",
        detail: data,
      });
    }

    const rawReply = data?.choices?.[0]?.message?.content || "";
    const reply = sanitizeAssistantReply(rawReply);

    session.messages.push({
      role: "assistant",
      content: reply,
    });

    session.messages = trimHistory(session.messages);
    session.updatedAt = Date.now();

    return res.json({
      reply,
      sessionId: cleanSessionId,
    });
  } catch (error) {
    console.error("ERROR SERVIDOR:", error);
    return res.status(500).json({
      error: "Error en el servidor",
    });
  }
});

app.post("/chat/reset", (req, res) => {
  const { sessionId = "default" } = req.body || {};
  const cleanSessionId = String(sessionId).trim() || "default";
  sessions.delete(cleanSessionId);

  return res.json({
    ok: true,
    sessionId: cleanSessionId,
    message: "Sesión reiniciada",
  });
});

app.listen(PORT, () => {
  console.log(`Servidor activo en puerto ${PORT} 🚀`);
});
