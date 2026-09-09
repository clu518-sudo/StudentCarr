const parseSseMessage = (rawMessage) => {
  const lines = rawMessage
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return null;
  }

  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  const eventName = eventLine ? eventLine.slice(6).trim() : "message";
  const dataText = dataLines.join("\n");

  let payload = {};
  if (dataText) {
    try {
      payload = JSON.parse(dataText);
    } catch {
      payload = { message: dataText };
    }
  }

  return { eventName, payload };
};

const streamSseResponse = async (
  response,
  { onEvent = () => {}, errorEventMessage = "Streaming request failed" } = {},
) => {
  if (!response.body) {
    throw new Error("Streaming is not supported in this browser");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const processMessage = (rawMessage) => {
    const parsed = parseSseMessage(rawMessage);
    if (!parsed) {
      return;
    }

    onEvent(parsed.eventName, parsed.payload);
    if (parsed.eventName === "error") {
      throw new Error(parsed.payload?.error || errorEventMessage);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split("\n\n");
    buffer = messages.pop() || "";

    for (const message of messages) {
      processMessage(message);
      // A fast local hop (e.g. a tool call) can deliver several complete
      // frames in one chunk. Without a yield here they'd all apply in the
      // same synchronous turn and the browser would never paint the
      // intermediate state (a tool_start immediately erased by tool_end).
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  if (buffer.trim()) {
    processMessage(buffer);
  }
};

export { streamSseResponse };
