import { randomUUID } from "node:crypto";
import { sendMessageSchema, validate } from "./chat.schemas.js";
import { requestChatTurn, requestChatTurnStream } from "./aiServiceClient.js"
import { getDecryptedLlmKey } from "../llmSettings/llmSettings.service.js";
import { signMcpToken } from "./mcpToken.js";
import { initSseHeaders, sendSseEvent } from "../events/sse.js";
import { 
  resolveThread,
  loadRecentHistory,
  appendTurn,
  getLatestThreadWithMessages,
  deleteChatHistory,
} from "./chat.service.js"
import env from "../config/env.js";
import { success } from "zod";


const formatZodError = (error) => {
  if (!error?.issues) return "Invalid request payload";
  return error.issues
    .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
    .join(", ");
};

const sendChatMessage = async (req, res, next) => {
  const requestId = randomUUID();
  try {
    const payload = validate(sendMessageSchema, req.body || {});
    console.log(`[chat:${requestId}] turn start user=${req.user.id}`);

    const userLlmKey = await getDecryptedLlmKey({ userId: req.user.id });
    if (!userLlmKey) {
      return res.status(400).json({
        success: false,
        error: "Add an LLM setting before chatting.",
      });
    }

    const llmSettings = {
      apiKey: userLlmKey.apiKey,
      model: userLlmKey.model || undefined,
      baseUrl: userLlmKey.baseUrl || undefined,
    };

    //get conversation history 
    const thread = await resolveThread({
      userId: req.user.id,
      threadId: payload.threadId,
      firstMessage: payload.message,
    });
    const history = await loadRecentHistory(thread.id);
    
    // Minted per turn from the verified session, never from client input.
    const result = await requestChatTurn(
      {
        message: payload.message,
        history,
        userId: req.user.id,
        mcpToken: signMcpToken(req.user.id),
        maxSteps: env.chatMaxSteps,
        llmSettings,
      },
      { requestId },
    );

    // AIServices returns only the final text, so tool calls and tool results
    // cannot enter the store even by accident.
    await appendTurn({
      threadId: thread.id,
      userMessage: payload.message,
      assistantReply: result.reply,
    });

    console.log(`[chat:${requestId}] turn complete user=${req.user.id}`);
    return res.json({
      success: true,
      data: { reply: result.reply, threadId: thread.id },
    });
  } catch (error) {
    console.error(`[chat:${requestId}] turn failed user=${req.user.id}:`, error.message);
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const streamChatMessage = async (req, res, next) => {
  const requestId = randomUUID();
  let payload;
  try {
    payload = validate(sendMessageSchema, req.body || {});
    console.log(`[chat:${requestId}] stream start user=${req.user.id}`);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }

  let streamClosed = false;
  req.on("aborted", () => {
    streamClosed = true;
  });

  try {
    const userLlmKey = await getDecryptedLlmKey({ userId: req.user.id });
    if (!userLlmKey) {
      return res.status(400).json({
        success: false,
        error: "Add an LLM setting before chatting.",
      });
    }

    const llmSettings = {
      apiKey: userLlmKey.apiKey,
      model: userLlmKey.model || undefined,
      baseUrl: userLlmKey.baseUrl || undefined,
    };

    const thread = await resolveThread({
      userId: req.user.id,
      threadId: payload.threadId,
      firstMessage: payload.message,
    });
    const history = await loadRecentHistory(thread.id);

    initSseHeaders(res);
    res.on("close", () => {
      streamClosed = true;
    });

    let replyText = "";

    await requestChatTurnStream(
      {
        message: payload.message,
        history,
        userId: req.user.id,
        mcpToken: signMcpToken(req.user.id),
        maxSteps: env.chatMaxSteps,
        llmSettings,
      },
      async ({ eventName, payload: eventPayload }) => {
        if (streamClosed) return;

        if (eventName === "completed") {
          replyText = eventPayload?.reply || "";
          return; // relayed below, once persisted, with threadId attached
        }

        sendSseEvent(res, eventName, eventPayload);
      },
      { requestId },
    );

    if (streamClosed) return;

    await appendTurn({
      threadId: thread.id,
      userMessage: payload.message,
      assistantReply: replyText,
    });

    console.log(`[chat:${requestId}] stream complete user=${req.user.id}`);
    sendSseEvent(res, "completed", { reply: replyText, threadId: thread.id });
    res.end();
  } catch (error) {
    console.error(`[chat:${requestId}] stream failed user=${req.user.id}:`, error.message);
    if (streamClosed) return;
    if (!res.headersSent) {
      return next(error);
    }
    sendSseEvent(res, "error", {
      error: error.message || "Chat stream failed",
    });
    res.end();
  }
};

const getChatHistory = async (req, res, next) => {
  try {
    const data = await getLatestThreadWithMessages(req.user.id);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

// Backs the "clear history" button — starts a fresh thread on the user's next message.
const clearChatHistory = async (req, res, next) => {
  try {
    await deleteChatHistory(req.user.id);
    return res.json({ success: true, data: { cleared: true } });
  } catch (error) {
    return next(error);
  }
};

export { sendChatMessage, streamChatMessage, getChatHistory, clearChatHistory };
