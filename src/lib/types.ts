import { EventEmitter } from "node:events";
import { ResponseInputItem } from "openai/resources/responses/responses.mjs";
import VoiceResponse from "twilio/lib/twiml/VoiceResponse.js";

export interface ConversationRelayParams
  extends VoiceResponse.ConversationRelayAttributes {
  transcriptionProvider?: "deepgram" | "google";
  ttsProvider?: "ElevenLabs" | "google" | "amazon";

  speechModel?: /** Deepgram */
  | "nova-3-general"

    /** Deepgram */
    | "nova-3-medical"

    /** Deepgram */
    | "nova-2"
    /** Deepgram */
    | "nova-2-phonecall"
    /** Deepgram */
    | "nova-2-meeting"
    /** Deepgram */
    | "nova-2-finance"
    /** Deepgram */
    | "nova-2-conversationalai"
    /** Deepgram */
    | "nova-2-voicemail"
    /** Deepgram */
    | "nova-2-medical"
    /** Deepgram */
    | "nova-2-drivethru"
    /** Deepgram */
    | "nova-2-automotive"
    /** Deepgram */
    | "nova-2-atc"
    /** Deepgram */
    | "nova-2-video"
    /** Deepgram */
    | "nova-2-video"
    /** Deepgram */
    | "nova-2-video"

    /** Google */
    | "long"
    /** Google */
    | "short"
    /** Google */
    | "telephony"
    /** Google */
    | "telephony_short"
    /** Google */
    | "medical_dictation"
    /** Google */
    | "medical_conversation"
    /** Google */
    | "chirp_2"
    /** Google */
    | "chirp_telephony"
    /** Google */
    | "chirp";
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
  context?: Record<string, any>;
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
