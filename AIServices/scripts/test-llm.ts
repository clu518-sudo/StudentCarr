// Checks an LLM setting (key / model / base URL) with the same ChatOpenAI
// construction the app uses. Set the three env vars below, then run:
//
//   TEST_LLM_API_KEY=... TEST_LLM_MODEL=... TEST_LLM_BASE_URL=... npx tsx scripts/test-llm.ts
import { ChatOpenAI } from "@langchain/openai";

const API_KEY = process.env.TEST_LLM_API_KEY;
const MODEL = process.env.TEST_LLM_MODEL;
const BASE_URL = process.env.TEST_LLM_BASE_URL;

if (!API_KEY || !MODEL || !BASE_URL) {
  console.error(
    "Set TEST_LLM_API_KEY, TEST_LLM_MODEL, and TEST_LLM_BASE_URL before running this script.",
  );
  process.exit(1);
}

console.log(`Calling ${BASE_URL} with model ${MODEL}, key ...${API_KEY.slice(-4)}`);

const llm = new ChatOpenAI({
  apiKey: API_KEY,
  model: MODEL,
  temperature: 0,
  timeout: 45000,
  maxRetries: 0,
  configuration: { baseURL: BASE_URL },
});

try {
  const reply = await llm.invoke("Reply with the single word: pong");
  console.log("OK:", reply.content);
} catch (error) {
  console.error("FAILED:", error);
}
