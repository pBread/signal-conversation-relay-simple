import Fastify from "fastify";
import fastifyFormbody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

// Create the Fastify Server and include middleware for accepting
// x-www-form-urlencoded content
// and setting up Web Sockets
const fastify = Fastify();
fastify.register(fastifyFormbody);
fastify.register(fastifyWs);

if (!process.env.NGROK_DOMAIN)
  throw new Error(`No Ngrok Domain has been specified in .env`);
if (!process.env.PORT) throw new Error(`No Port specified in the .env file`);

// Setup Configuration Options
const NGROK_DOMAIN = process.env.NGROK_DOMAIN;
const WS_URL = `wss://${NGROK_DOMAIN}/ws`;
const PORT = process.env.PORT || 8080;
const OPEN_AI_MODEL = "gpt-4o-mini";

// Setup Welcome Greeting
const WELCOME_GREETING = `Hi! I am a voice assistant powered by Twilio and Open AI. Ask me anything!`;

// Setup the Interrupt Variable
const INTERRUPT = "any";

// Create the TwiML
const TWIML = `<?xml version="1.0" encoding="UTF-8"?>
 <Response>
    <Connect>
        <ConversationRelay url="${WS_URL}" welcomeGreeting="${WELCOME_GREETING}" interruptible="${INTERRUPT}" />
    </Connect>
 </Response>
`;
// Create a simple sessions handler
const sessions = new Map();

// Setup the System Prompt
const SYSTEM_PROMPT = `
You are a helpful assistant. This conversation is being translated to voice, so answer carefully.
When you respond, please spell out all numbers, for example twenty not 20.
Do not include emojis in your responses. Do not include bullet points, asterisks, or special symbols.
`;

// Setup the LLM to handle completions
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// // Setup the route for TwiML and output the request for debugging
fastify.post("/twiml", async (request, reply) => {
  console.log("=== Incoming Request ===");
  console.log("Method:", request.method);
  console.log("URL:", request.url);
  console.log("Headers:", request.headers);
  console.log("Body:", request.body);
  console.log("========================");

  reply.type("text/xml").send(TWIML);
});

fastify.get("/ws", { websocket: true }, (ws) => {});

// // Register the Web Socket
fastify.register(async function (fastify) {
  // On a get request against the WebSocket
  fastify.get("/ws", { websocket: true }, (ws, req) => {
    // When a message is received
    ws.on("message", async (data) => {
      // Get the message data
      const message = JSON.parse(data);

      // out the payload to the console
      console.log(`MESSAGE ${JSON.stringify(message, null, 2)}`);

      switch (message.type) {
        case "setup":
          // get the call sid as the unique identifier to the session
          const callSid = message.callSid;
          ws.callSid = callSid;
          // add the system prompt to the session
          sessions.set(callSid, [{ role: "system", content: SYSTEM_PROMPT }]);
          console.log(
            `SETUP ${JSON.stringify(sessions.get(ws.callSid), null, 2)}`,
          );
          break;
        case "prompt":
          // get the messages by call sid
          const messages = sessions.get(ws.callSid);

          // add the voice prompt to the messages
          messages.push({ role: "user", content: message.voicePrompt });

          let reply = "";

          const stream = await openai.chat.completions.create({
            model: OPEN_AI_MODEL,
            messages: messages,
            stream: true,
          });

          // iterate through the stream in chunks
          for await (const chunk of stream) {
            // if there is a token get it
            const token = chunk.choices?.[0].delta.content;
            if (token) {
              reply += token;
            }

            // construct a simple SPI message
            const tts = {
              type: "text",
              token: token,
              last: false,
            };

            // send the SPI message to TTS
            ws.send(JSON.stringify(tts));
            // console.log(`RESPONSE -> ${JSON.stringify(tts, null, 2)}`)
          }

          // add the full text to the session
          messages.push({ role: "assistant", content: reply });

          // send the final message
          const tts = {
            type: "text",
            token: "",
            last: true,
          };
          ws.send(JSON.stringify(tts));
          console.log(`RESPONSE -> ${JSON.stringify(tts, null, 2)}`);
          console.log(`RESPONSE -> ${reply}`);
          break;
        case "interrupt":
          // in the case of an interrupt construct a final message token
          const interrupt = {
            type: "text",
            token: "",
            last: true,
          };
          ws.send(JSON.stringify(interrupt));
          console.log(`INTERRUPT -> ${JSON.stringify(interrupt, null, 2)}`);
          break;
        default:
          console.warn("Unknown message type received:", message.type);
          break;
      }
    });

    // tidyup on close
    ws.on("close", () => {
      console.log("WebSocket connection closed");
    });
  });
});

try {
  fastify.listen({ port: PORT });
  console.log(
    `Server running at http://localhost:${PORT} and wss://${NGROK_DOMAIN}/ws`,
  );
} catch (e) {
  fastify.log.error(`Fastify Server Error ${e}`);
  process.exit(1);
}
