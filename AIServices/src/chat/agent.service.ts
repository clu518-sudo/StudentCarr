import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";

const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 45000);
const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 2);
const DEFAULT_MODEL = "gpt-4.1-mini";

const SYSTEM_PROMPT =
  "You are the StudentCarr career assistant. StudentCarr helps students " +
  "manage their job search: profile, applications, skills, and interview " +
  "prep. Be concise and practical.";

class ServiceError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
  }
}

// LLM credentials come only from the user's saved Settings-panel entry,
// forwarded per request by Backend (getDecryptedLlmKey) — never from env.
const llmSettingsSchema = z.object({
  apiKey: z.string().trim().min(1),
  model: z.string().trim().min(1).optional(),
  baseUrl: z.string().trim().min(1).optional(),
});
type LlmSettings = z.infer<typeof llmSettingsSchema>;

const buildModel = (llmSettings: LlmSettings) =>
  new ChatOpenAI({
    apiKey: llmSettings.apiKey,
    model: llmSettings.model || DEFAULT_MODEL,
    temperature: 0.3,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
    configuration: llmSettings.baseUrl
      ? { baseURL: llmSettings.baseUrl }
      : undefined,
  });

// Rebuilt per turn (not cached) since credentials vary per user/request.
const buildAgent = (llmSettings: LlmSettings) =>
  createAgent({
    model: buildModel(llmSettings),
    tools: [],
    systemPrompt: SYSTEM_PROMPT,
  });

export const runChatTurn = async ({
  message,
  llmSettings,
}: {
  message: string;
  llmSettings: unknown;
}): Promise<{ reply: string }> => {
  const parsedSettings = llmSettingsSchema.safeParse(llmSettings);
  if (!parsedSettings.success) {
    throw new ServiceError(
      "No LLM configured for this account. Add one in Settings before chatting.",
      400,
    );
  }

  const agent = buildAgent(parsedSettings.data);
  const result = await agent.invoke({
    messages: [new HumanMessage(message)],
  });

  const lastMessage = result.messages[result.messages.length - 1] as AIMessage;
  const reply =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  return { reply };
};

export { ServiceError };
