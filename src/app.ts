import "dotenv/config";
import express from "express";
import ExpressWs from "express-ws";
import twilio from "twilio";

import { log } from "./lib/logger.ts";
import { TypedWs } from "./lib/typed-ws.ts";
import type {
  ConversationRelayParams,
  IncomingCallPayload,
  Store,
} from "./lib/types.ts";
import { LLMService } from "./llm.ts";
import * as voices from "./voices.ts";

const { HOSTNAME, PORT = 8080 } = process.env;

const { app } = ExpressWs(express());
app.use(express.urlencoded({ extended: true })).use(express.json());

// Incoming Call Webhook Handler
app.post("/incoming-call", async (req, res) => {
  const { CallSid } = req.body as IncomingCallPayload;
  log.webhook("/incoming-call", CallSid);

  const response = new twilio.twiml.VoiceResponse();
  // IVR
  response.say(
    "Hi, you've reach Owl Inc. Press 1 for support, press 2 for some other department, etc.",
  );

  response.gather({
    action: `https://${HOSTNAME}/gather`,
    finishOnKey: "#",
  });

  // // RELAY
  // const connect = response.connect();

  // const args: ConversationRelayParams = {
  //   url: `wss://${HOSTNAME}/relay`,
  //   welcomeGreeting:
  //     "Hello! I am a voice assistant powered by Twilio Conversation Relay and Azure Foundry!",

  //   transcriptionProvider: "deepgram",
  //   speechModel: "nova-3-general",

  //   ttsProvider: "ElevenLabs",
  //   voice: voices.en.jessica_anne,
  // };

  // const cr = connect.conversationRelay(args);

  // cr.parameter({ name: "greeting", value: args.welcomeGreeting });

  const twiml = response.toString();
  log.xml("twiml", twiml);
  res.type("text/xml").send(twiml);
});

// Conversation Relay Connection
app.ws("/relay", (ws, req) => {
  log.info("relay", "initialized");

  const wss = new TypedWs(ws);

  const store: Store = { context: {}, msgs: [] };
  const llm = new LLMService(store);

  // payload with session details
  wss.on("setup", (ev) => {
    log.info("relay.setup", ev);

    // // RELAY
    // const { greeting } = ev;
    // if (greeting) store.msgs.push({ role: "assistant", content: greeting });
  });

  // user speaking
  wss.on("prompt", (ev) => {
    if (!ev.last) return; // ignore partial speech
    log.cyan("relay.prompt", ev);

    // // RELAY
    // store.msgs.push({ role: "user", content: ev.voicePrompt });
    // llm.run();
  });

  // user interrupts the bot
  wss.on("interrupt", (ev) => {
    log.cyan("relay.interrupt", ev);
  });

  // llm wants to speak
  llm.on("text", (text, last, transcript) => {
    if (last) log.pink("llm.text", transcript);

    // // RELAY
    // wss.sendTextToken(text, last);
  });
});

app.post("/gather", (req, res) => {
  log.info("gather", `digits ${req.body.Digits}`);
  res.send("");
});

app.listen(PORT, () => {
  console.info(`server running on http://localhost:${PORT}`);
});
