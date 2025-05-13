import "@types/twilio/lib/twiml/VoiceResponse";

declare namespace NodeJS {
  export interface ProcessEnv {
    HOSTNAME: string;

    TWILIO_ACCOUNT_SID: string;
    TWILIO_API_KEY: string;
    TWILIO_API_SECRET: string;

    FOUNDRY_LLM_DEPLOYMENT: string;
    FOUNDRY_LLM_ENDPOINT: string;
    FOUNDRY_API_KEY: string;
  }
}
