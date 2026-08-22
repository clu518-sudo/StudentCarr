import env from "../config/env.js";

const AI_BASE_URL = String(
  env.progressTrackingServiceBaseUrl || "http://127.0.0.1:10002",
).replace(/\/$/, "");

const createHttpError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const requestChatTurn = async (payload) => {
  let response;
  try {
    response = await fetch(`${AI_BASE_URL}/chat/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw createHttpError(
      "Unable to reach the AI chat service. Make sure AIServices is running.",
      502,
    );
  }

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(
      responseBody?.error || "AI chat request failed.",
      response.status >= 400 ? response.status : 502,
    );
  }

  return responseBody?.data || {};
};

export { requestChatTurn };
