import { WebSocket } from "ws";
import { TypedEventEmitter } from "./types.ts";

export class TypedWs {
  constructor(private ws: WebSocket) {
    ws.on("message", this.parse);
  }

  // ========================================
  // Actions
  // ========================================
  /** Send an action to Twilio */
  send = (action: TwilioAction) => this.ws.send(JSON.stringify(action));

  /** Ends the session and optionally provides hand-off data. */
  end = (handoffData?: HandoffData) =>
    this.send({ type: "end", handoffData: JSON.stringify(handoffData ?? {}) });

  playMedia = (
    source: string,
    opts: { loop?: number; preemptible?: boolean } = {},
  ) =>
    this.send({
      type: "play",
      source,
      loop: opts.loop ?? 1,
      preemptible: opts.preemptible ?? false,
    });

  /** Sends DTMF tones to the caller. */
  sendDTMF = (digits: string) => this.send({ type: "sendDigits", digits });

  /** Sends a text token for streaming TTS. */
  sendTextToken = (token: string, last: boolean) =>
    this.send({ type: "text", token: token ?? "", last });

  /** Switch the STT and TTS language. */
  switchLanguage = (language: string) =>
    this.send({
      type: "language",
      transcriptionLanguage: language,
      ttsLanguage: language,
    });

  // ========================================
  // Event Emitter Logic
  // ========================================
  private emitter = new TypedEventEmitter<TypedWsEvents>();
  public on: (typeof this.emitter)["on"] = (...args) =>
    this.emitter.on(...args);

  parse = (data: any) => {
    const msg: TwilioRelayMessage = JSON.parse(data);

    switch (msg.type) {
      case "setup":
        const params = msg.customParameters ?? {};
        const context =
          typeof params.context === "string" ? safeParse(params.context) : {};
        const greeting = params.greeting as string | undefined;
        this.emitter.emit("setup", { ...msg, context, greeting });
        break;

      default:
        this.emitter.emit(msg.type, msg as any);
    }
  };
}

export interface TypedWsEvents {
  message: (ev: TwilioRelayMessage) => void;

  dtmf: (ev: DTMFMessage) => void;
  error: (ev: ErrorMessage) => void;
  info: (ev: InfoMessage) => void;
  interrupt: (ev: HumanInterrupt) => void;
  prompt: (ev: PromptMessage) => void;
  setup: (ev: SetupMessage) => void;
  tokensPlayed: (ev: TokensPlayedMessage) => void;

  close: (ev: undefined) => void;
  wsError: (err: Error) => void;
}
// ========================================
// Action Types
// ========================================
type TwilioAction =
  | EndSession
  | PlayMedia
  | SendDigits
  | SendTextToken
  | SwitchLanguage;

type EndSession = {
  type: "end";
  handoffData: string;
};

type PlayMedia = {
  type: "play";
  loop: number;
  preemptible?: boolean;
  source: string;
};

type SendDigits = {
  type: "sendDigits";
  digits: string;
};

type SendTextToken = {
  type: "text";
  last: boolean;
  token: string;
};

type SwitchLanguage = {
  type: "language";
  ttsLanguage?: string;
  transcriptionLanguage?: string;
};

// ========================================
// Incoming Messages
// ========================================

type TwilioRelayMessage =
  | DTMFMessage
  | ErrorMessage
  | HumanInterrupt
  | PromptMessage
  | SetupMessage
  | TokensPlayedMessage
  | InfoMessage;

type DTMFMessage = {
  type: "dtmf";
  digit: string;
};

type ErrorMessage = {
  type: "error";
  description: string;
};

type HumanInterrupt = {
  type: "interrupt";
  durationUntilInterruptMs: string;
  utteranceUntilInterrupt: string;
};

type PromptMessage = {
  type: "prompt";
  voicePrompt: string;
  lang: "en-US";
  last: true;
};

export type SetupMessage = {
  type: "setup";
  accountSid: string;
  applicationSid: string | null;
  callerName: string;
  callSid: string;
  callStatus: string;
  callType: "PSTN";
  customParameters?: Record<string, string> & {
    context?: string;
    greeting?: string;
  };
  direction: "inbound";
  forwardedFrom: string;
  from: string;
  parentCallSid: string;
  sessionId: string;
  to: string;
  context?: Record<string, any>;
  greeting?: string;
};

export type TokensPlayedMessage = {
  type: "info";
  name: "tokensPlayed";
  value: string;
};

export interface InfoMessage {
  type: "info";
  [key: string]: any;
}

export type HandoffData<T extends { reasonCode: string } = any> = T;

function safeParse(str: string): Record<string, any> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
