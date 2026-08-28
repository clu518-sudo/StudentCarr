import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "..", ".env") });

import { generateUserInformationProfile } from "./generate_user_infomation.js";
import {
  generateInviteReplyDraft,
  sendInviteReply,
  syncProgressTrackingMailbox,
} from "./progress_tracking_gmail.js";

import { runChatTurn, ServiceError } from "./chat/agent.service.js"

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

const handleChatTurn = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => {
  try {
    const payload = (await parseRequestBody(req)) as {
      message?: unknown;
      userId?: unknown;
      mcpToken?: unknown;
      maxSteps?: unknown;
      llmSettings?: unknown;
    };
    if (typeof payload?.message !== "string" || !payload.message.trim()) {
      writeJson(res, 400, { success: false, error: "message is required" });
      return;
    }

    const result = await runChatTurn({
      message: payload.message,
      userId: payload.userId,
      mcpToken: payload.mcpToken,
      maxSteps: payload.maxSteps,
      llmSettings: payload.llmSettings,
    });

    writeJson(res, 200, { success: true, data: result });
  } catch (error) {
    const statusCode = error instanceof ServiceError ? error.statusCode : 500;
    writeJson(res, statusCode, {
      success: false,
      error: error instanceof Error ? error.message : "Chat turn failed",
    });
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


    writeJson(res, 404, { success: false, error: "Not found" });
  });

  server.listen(port, host, () => {
    console.log(`AI services listening on http://${host}:${port}`);
  });

  return server;
};

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === modulePath) {
  startAiServer();
}
