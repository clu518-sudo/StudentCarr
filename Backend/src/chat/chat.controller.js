import { sendMessageSchema, validate } from "./chat.schemas.js";
import { requestChatTurn } from "./aiServiceClient.js"
import { getDecryptedLlmKey } from "../llmSettings/llmSettings.service.js";
import { signMcpToken } from "./mcpToken.js";
import { 
  resolveThread,
  loadRecentHistory,
  appendTurn,
  getLatestThreadWithMessages,
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
  try {
    const payload = validate(sendMessageSchema, req.body || {});

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
    const result = await requestChatTurn({
      message: payload.message,
      history,
      userId: req.user.id,
      mcpToken: signMcpToken(req.user.id),
      maxSteps: env.chatMaxSteps,
      llmSettings,
    });

    // AIServices returns only the final text, so tool calls and tool results
    // cannot enter the store even by accident.
    await appendTurn({
      threadId: thread.id,
      userMessage: payload.message,
      assistantReply: result.reply,
    });

    return res.json({
      success: true,
      data: { reply: result.reply, threadId: thread.id },
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
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

export { sendChatMessage, getChatHistory };
