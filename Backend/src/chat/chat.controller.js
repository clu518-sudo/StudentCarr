import { sendMessageSchema, validate } from "./chat.schemas.js";
import { requestChatTurn } from "./aiServiceClient.js"
import { getDecryptedLlmKey } from "../llmSettings/llmSettings.service.js";

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

    const result = await requestChatTurn({ message: payload.message, llmSettings });
    return res.json({
      success: true,
      data: { reply: result.reply },
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

export { sendChatMessage };
