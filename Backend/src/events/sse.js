const initSseHeaders = (res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
};

const sendSseEvent = (res, eventName, payload = {}) => {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const sendSseComment = (res, comment = "keepalive") => {
  res.write(`: ${comment}\n\n`);
};

export { initSseHeaders, sendSseComment, sendSseEvent };
