import "dotenv/config";
import express from "express";
import ExpressWs from "express-ws";
import twilio from "twilio";
import { log } from "./lib/logger.ts";
import { TypedWs } from "./lib/typed-ws.ts";
import type {
  ConversationRelayParams,
  IncomingCallPayload,
} from "./lib/types.ts";
import { LLMService } from "./llm.ts";
import * as voices from "./voices.ts";

const { HOSTNAME, PORT = 3333 } = process.env;

const { app } = ExpressWs(express());
app.use(express.urlencoded({ extended: true })).use(express.json());

// Incoming Call Webhook Handler
app.post("/incoming-call", async (req, res) => {
  log.webhook("/incoming-call");

  const response = new twilio.twiml.VoiceResponse();

  response.say("Ahoy, press 1, or 2, or 3");
  response.gather({
    action: `https://${HOSTNAME}/gather`,
    input: ["dtmf"],
    finishOnKey: "#",
  });

  log.xml("twiml", response.toString());
  res.type("text/xml").send(response.toString());
});

// Conversation Relay Connection
app.ws("/relay", (ws, req) => {
  log.info("relay", "initialized");

  const wss = new TypedWs(ws);
  const llm = new LLMService();

  // user speaking
  wss.on("prompt", (ev) => {
    if (!ev.last) return; // ignore partial speech
    log.cyan("relay.prompt", ev);
  });

  // llm wants to speak
  llm.on("text", (text, last, transcript) => {
    if (last) log.llm("llm.text", transcript);
  });

  // user interrupts the bot
  wss.on("interrupt", (ev) => {
    log.cyan("relay.interrupt", ev);
  });

  // payload with session details
  wss.on("setup", (ev) => {
    log.info("relay.setup", ev);
  });
});

app.post("/gather", (req, res) => {
  log.info("gather", `digits ${req.body.Digits}`);
  res.send("");
});

app.listen(PORT, () => {
  console.info(`server running on http://localhost:${PORT}`);
});
