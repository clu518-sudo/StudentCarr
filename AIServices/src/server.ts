import http from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", ".env") });

import "./lib/httpAgent.js";
import { generateUserInformationProfile } from "./generate_user_infomation.js";
import {
  generateInviteReplyDraft,
  sendInviteReply,
  syncProgressTrackingMailbox,
} from "./progress_tracking_gmail.js";

import { runChatTurn, runChatTurnStream, ServiceError } from "./chat/agent.service.js"
import { closeAllMcpClients } from "./chat/mcpClient.service.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = Number(process.env.LANGGRAPH_PORT || 10002);

const parseRequestBody = async (req: http.IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text);
};

const writeJson = (
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};


// Handlers
const handleProfileGeneration = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  try {
    const payload = (await parseRequestBody(req)) as {
      currentManualProfile: unknown;
      documents: unknown[];
    };

    const manualProfile = await generateUserInformationProfile({
      currentManualProfile: (payload?.currentManualProfile || {}) as never,
      documents: Array.isArray(payload?.documents) ? (payload.documents as never) : [],
    });

    writeJson(res, 200, {
      success: true,
      data: { manualProfile },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      writeJson(res, 400, {
        success: false,
        error: "Invalid generation payload",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    writeJson(res, 500, {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate manual profile",
    });
  }
};

const handleProgressSync = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  try {
    const payload = await parseRequestBody(req);
    const result = await syncProgressTrackingMailbox(payload);
    writeJson(res, 200, { success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      writeJson(res, 400, {
        success: false,
        error: "Invalid progress sync payload",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    writeJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Progress sync failed",
    });
  }
};

const handleReplyDraft = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  try {
    const payload = await parseRequestBody(req);
    const result = await generateInviteReplyDraft(payload);
    writeJson(res, 200, { success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      writeJson(res, 400, {
        success: false,
        error: "Invalid reply draft payload",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    writeJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Reply draft generation failed",
    });
  }
};

const handleSendReply = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  try {
    const payload = await parseRequestBody(req);
    const result = await sendInviteReply(payload);
    writeJson(res, 200, { success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      writeJson(res, 400, {
        success: false,
        error: "Invalid reply send payload",
        details: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    writeJson(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Reply send failed",
    });
  }
};

const requestIdOf = (req: http.IncomingMessage) =>
  (Array.isArray(req.headers["x-request-id"])
    ? req.headers["x-request-id"][0]
    : req.headers["x-request-id"]) || randomUUID();

const handleChatTurn = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  const requestId = requestIdOf(req);
  try {
    const payload = (await parseRequestBody(req)) as {
      message?: unknown;
      history?: unknown;
      userId?: unknown;
      mcpToken?: unknown;
      maxSteps?: unknown;
      llmSettings?: unknown;
    };
    if (typeof payload?.message !== "string" || !payload.message.trim()) {
      writeJson(res, 400, { success: false, error: "message is required" });
      return;
    }

    console.log(`[chat:${requestId}] turn start`);
    const result = await runChatTurn({
      message: payload.message,
      history: payload.history,
      userId: payload.userId,
      mcpToken: payload.mcpToken,
      maxSteps: payload.maxSteps,
      llmSettings: payload.llmSettings,
    });
    console.log(`[chat:${requestId}] turn complete`);

    writeJson(res, 200, { success: true, data: result });
  } catch (error) {
    console.error(`[chat:${requestId}] turn failed:`, error);
    const statusCode = error instanceof ServiceError ? error.statusCode : 500;
    writeJson(res, statusCode, {
      success: false,
      error: error instanceof Error ? error.message : "Chat turn failed",
    });
  }
};

const writeSseHeaders = (res: http.ServerResponse) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
};

const writeSseEvent = (
  res: http.ServerResponse,
  eventName: string,
  payload: unknown = {},
) => {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const handleChatStream = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  const requestId = requestIdOf(req);
  let payload: {
    message?: unknown;
    history?: unknown;
    userId?: unknown;
    mcpToken?: unknown;
    maxSteps?: unknown;
    llmSettings?: unknown;
  };

  try {
    payload = (await parseRequestBody(req)) as typeof payload;
  } catch {
    writeJson(res, 400, { success: false, error: "Invalid request body" });
    return;
  }

  if (typeof payload?.message !== "string" || !payload.message.trim()) {
    writeJson(res, 400, { success: false, error: "message is required" });
    return;
  }

  writeSseHeaders(res);

  let clientClosed = false;
  req.on("aborted", () => {
    clientClosed = true;
  });

  console.log(`[chat:${requestId}] stream start`);
  try {
    for await (const streamEvent of runChatTurnStream({
      message: payload.message,
      history: payload.history,
      userId: payload.userId,
      mcpToken: payload.mcpToken,
      maxSteps: payload.maxSteps,
      llmSettings: payload.llmSettings,
    })) {
      if (clientClosed) break;
      writeSseEvent(res, streamEvent.event, streamEvent.data);
    }
    console.log(`[chat:${requestId}] stream complete`);
  } catch (error) {
    console.error(`[chat:${requestId}] stream failed:`, error);
    if (!clientClosed) {
      writeSseEvent(res, "error", {
        error: error instanceof Error ? error.message : "Chat stream failed",
      });
    }
  } finally {
    if (!clientClosed) res.end();
  }
};


// start the AI services here 
export const startAiServer = (port = DEFAULT_PORT, host = DEFAULT_HOST) => {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      writeJson(res, 200, { success: true, status: "ok" });
      return;
    }

    if (req.method === "POST" && req.url === "/generate-profile") {
      await handleProfileGeneration(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/progress-tracking/sync") {
      await handleProgressSync(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/progress-tracking/reply-draft") {
      await handleReplyDraft(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/progress-tracking/send-reply") {
      await handleSendReply(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/chat/turn") {
      await handleChatTurn(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/chat/stream") {
      await handleChatStream(req, res);
      return;
    }

    writeJson(res, 404, { success: false, error: "Not found" });
  });

  server.listen(port, host, () => {
    console.log(`AI services listening on http://${host}:${port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(() => {
      closeAllMcpClients().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
};

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  startAiServer();
}
