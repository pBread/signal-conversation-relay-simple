import "dotenv/config";
import { AzureOpenAI } from "openai/index.mjs";
import {
  ResponseInputItem,
  ResponseStreamEvent,
  Tool,
} from "openai/resources/responses/responses.mjs";
import { Stream } from "openai/streaming.mjs";
import { log } from "./lib/logger.ts";
import { Store, TypedEventEmitter } from "./lib/types.ts";

// ========================================
// LLM Configuration
// ========================================
const {
  FOUNDRY_LLM_DEPLOYMENT: model,
  FOUNDRY_LLM_ENDPOINT: endpoint,
  FOUNDRY_API_KEY: apiKey,
  apiVersion = "2025-03-01-preview",
} = process.env;

const instructions = `\
You are an assistant tasked with creating jokes and answering questions about the weather.

You should try to incorporate the joke into your responses about the weather. Don't tell these jokes:
- scarecrow is outstanding in his field

This conversation is being translated to voice, so answer carefully. Keep your answers relatively concise.
When you respond, please spell out all numbers, for example twenty not 20.
Do not include emojis in your responses. Do not include bullet points, asterisks, or special symbols.

`;

const tools: Tool[] = [
  {
    type: "function",
    name: "get_weather",
    strict: true,
    description: "Get the weather for a location",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          enum: ["san_francisco", "chicago", "seattle", "guangzhou"],
        },
      },
      required: ["location"],

      additionalProperties: false,
    },
  },
];

const get_weather = (argumentString: string) => {
  const args = JSON.parse(argumentString) as { location: string };

  switch (args.location.toLowerCase()) {
    case "san_francisco":
      return { weather: "chilly, probably rainy" };

    case "chicago":
      return { weather: "it's cold" };

    case "seattle":
      return { weather: "definitely raining" };

    case "guangzhou":
      return { weather: "it's sunny" };
  }
};

const executeTool = async (name: string, args: string) => {
  switch (name) {
    case "get_weather":
      return get_weather(args);

    default:
      return { status: "error", message: "unknown tool" };
  }
};

export class LLMService {
  client: AzureOpenAI;
  constructor(private store: Store) {
    console.debug("llm", { apiKey, apiVersion, endpoint });
    this.client = new AzureOpenAI({ apiKey, apiVersion, endpoint });
  }

  run = async () => {
    await this.doResponse();
  };

  stream: Stream<ResponseStreamEvent> | undefined;

  doResponse = async (
    previous_response_id?: string,
    input?: ResponseInputItem[],
  ) => {
    try {
      this.stream = await this.client.responses.create({
        model,
        stream: true,
        instructions,

        tools,
        ...(previous_response_id && input
          ? { previous_response_id, input }
          : { input: this.store.msgs }),
      });
    } catch (error) {
      log.error("llm", "error", error);
      return;
    }

    let responseId: string | undefined = undefined;
    let toolItems: ResponseInputItem[] = [];

    for await (const chunk of this.stream) {
      if (chunk.type === "response.created") {
        log.info("llm", "azure llm stream starting");
        responseId = chunk.response.id;
      }

      // ========================================
      // Text
      // ========================================
      if (chunk.type === "response.output_item.added") {
        if (chunk.item.type === "message") {
          if (chunk.item.content?.[0]?.type === "refusal") continue;

          const content = chunk.item.content?.[0]?.text || "";
          if (content.length) this.emit("text", content, false);
        }
      }

      if (chunk.type === "response.output_text.delta") {
        const delta = chunk.delta || "";
        this.emit("text", delta, false);
      }

      if (chunk.type === "response.output_text.done") {
        this.store.msgs.push({ role: "assistant", content: chunk.text });
        this.emit("text", "", true, chunk.text);
      }

      // ========================================
      // Tools
      // ========================================
      if (chunk.type === "response.output_item.done") {
        if (chunk.item.type === "function_call") {
          const toolItem: ResponseInputItem = {
            call_id: chunk.item.call_id,
            type: "function_call_output",
            output: "",
          };

          log.info("llm", `${chunk.item.name}(${chunk.item.arguments})`);

          const result = await executeTool(
            chunk.item.name,
            chunk.item.arguments,
          );
          toolItem.output = JSON.stringify(result);
          toolItems.push(toolItem);

          log.info("llm", `tool result: ${toolItem.output}`);
        }
      }
    }

    if (toolItems.length) return this.doResponse(responseId, toolItems);
  };

  // ========================================
  // Event Typing
  // ========================================
  emitter = new TypedEventEmitter<LLMEvents>();
  on: (typeof this.emitter)["on"] = (...args) => this.emitter.on(...args);
  emit: (typeof this.emitter)["emit"] = (...args) => this.emitter.emit(...args);
}

export interface LLMEvents {
  dtmf: (digits: string) => void; // dtmf digits the bot wants to send
  text: (text: string, last: boolean, fullText?: string) => void; // chunk of text the LLM wants to say
}
