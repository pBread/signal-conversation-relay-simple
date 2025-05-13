import { EventEmitter } from "node:events";
import { ResponseInputItem } from "openai/resources/responses/responses.mjs";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse.js";

export interface ConversationRelayParams
  extends VoiceResponse.ConversationRelayAttributes {
  transcriptionProvider?: "deepgram" | "google";
  ttsProvider?: "ElevenLabs" | "google" | "amazon";
}

export class TypedEventEmitter<Events = {}> extends EventEmitter {
  emit = <K extends keyof Events & (string | symbol)>(
    event: K,
    ...args: Parameters<
      Events[K] extends (...args: any[]) => any ? Events[K] : never
    >
  ): boolean => super.emit(event, ...args);

  on = <K extends keyof Events & (string | symbol)>(
    event: K,
    listener: Events[K] extends (...args: any[]) => any ? Events[K] : never,
  ): this => super.on(event, listener);
}

export interface Store {
  msgs: ResponseInputItem[];
}

export interface IncomingCallPayload {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  ApiVersion: string;
  Direction: "inbound" | "outbound-api";
  CallStatus:
    | "queued"
    | "ringing"
    | "in-progress"
    | "completed"
    | "busy"
    | "failed"
    | "no-answer";

  CallCost?: string;
  CallerId?: string;
  CallerName?: string;
  Duration?: string;
  ForwardedFrom?: string;
  FromCity?: string;
  FromCountry?: string;
  FromState?: string;
  FromZip?: string;
  RecordingSid?: string;
  RecordingUrl?: string;
  StartTime?: string;
  ToCity?: string;
  ToCountry?: string;
  ToState?: string;
  ToZip?: string;
}
