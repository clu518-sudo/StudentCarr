import { sendMessageSchema, validate } from "./chat.schemas.js";

const formatZodError = (error) => {
  if (!error?.issues) return "Invalid request payload";
  return error.issues
    .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
    .join(", ");
};

const sendChatMessage = async (req, res, next) => {
  try {
    validate(sendMessageSchema, req.body || {});
    // Phase 4 replaces this with a call to aiServiceClient.
    return res.json({
      success: true,
      data: { reply: "This is a placeholder reply." },
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

export { sendChatMessage };
