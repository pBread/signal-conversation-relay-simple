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
  log.info("incoming-call", CallSid);

  const response = new twilio.twiml.VoiceResponse();
  response.say("Hello Twilions!");

  const twiml = response.toString();
  log.xml("twiml\n", twiml);
  res.type("text/xml").send(twiml);
});

// Conversation Relay Connection
app.ws("/relay", (ws, req) => {
  log.info("relay", "initialized");

  const wss = new TypedWs(ws);

  const store: Store = { msgs: [] };
  const llm = new LLMService(store);

  // payload with session details
  wss.on("setup", (ev) => {
    log.info("on.setup", ev);
  });

  // user speaking
  wss.on("prompt", (ev) => {
    if (!ev.last) return; // ignore partial speech
    log.info("on.prompt", ev);
  });

  // user interrupts the bot
  wss.on("interrupt", (ev) => {
    log.info("on.interrupt", ev);
  });

  // llm wants to speak
  llm.on("text", (text, last, transcript) => {
    if (last) log.info("llm.text", transcript);
  });
});

app.listen(PORT, () => {
  log.info(`server running on http://localhost:${PORT}`);
});
