import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { StateGraph, START, END, Command } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import z from "zod";

// Load `.env` from the project root so `npx tsx demo.ts` from `src/` still finds keys.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", ".env") });

// Uses ChatOpenAI against an OpenAI-compatible API (default: Alibaba DashScope for Qwen).
// Point OPENAI_BASE_URL, DASHSCOPE_API_KEY, and MODEL at any compatible provider if you switch hosts.
const apiKey = process.env.DASHSCOPE_API_KEY ?? process.env.OPENAI_API_KEY;
