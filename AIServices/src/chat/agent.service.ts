import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const OPENAI_MODEL =
  process.env.OPENAI_MODEL || process.env.MODEL || "gpt-4.1-mini";
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 45000);
const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 2);

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

const buildModel = () => {
  if (!OPENAI_API_KEY) {
    throw new ServiceError(
      "OPENAI_API_KEY (or DASHSCOPE_API_KEY) is required for chat",
      500,
    );
  }
  return new ChatOpenAI({
    apiKey: OPENAI_API_KEY,
    model: OPENAI_MODEL,
    temperature: 0.3,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
    configuration: OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : undefined,
  });
};

let cachedAgent: ReturnType<typeof createReactAgent> | null = null;
const getAgent = () => {
  if (!cachedAgent) {
    cachedAgent = createReactAgent({
      llm: buildModel(),
      tools: [],
      prompt: SYSTEM_PROMPT,
    });
  }
  return cachedAgent;
};

export const runChatTurn = async ({
  message,
}: {
  message: string;
}): Promise<{ reply: string }> => {
  const agent = getAgent();
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
