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

const parseSseFrame = (raw) => {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;

  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  const eventName = eventLine ? eventLine.slice(6).trim() : "message";
  let payload = {};
  if (dataLines.length) {
    try {
      payload = JSON.parse(dataLines.join("\n"));
    } catch {
      payload = { message: dataLines.join("\n") };
    }
  }

  return { eventName, payload };
};

// Reads AIServices's SSE response and re-emits each frame via onFrame,
// rather than buffering the whole reply, mirrors App/src/lib/sseClient.js
// on the server side.
const readSseFrames = async (response, onFrame) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";

    for (const frame of frames) {
      const parsed = parseSseFrame(frame);
      if (parsed) await onFrame(parsed);
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseFrame(buffer);
    if (parsed) await onFrame(parsed);
  }
};

const requestChatTurnStream = async (payload, onFrame) => {
  let response;
  try {
    response = await fetch(`${AI_BASE_URL}/chat/stream`, {
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

  if (!response.ok) {
    const responseBody = await response.json().catch(() => ({}));
    throw createHttpError(
      responseBody?.error || "AI chat request failed.",
      response.status >= 400 ? response.status : 502,
    );
  }

  await readSseFrames(response, onFrame);
};

export { requestChatTurn, requestChatTurnStream };
