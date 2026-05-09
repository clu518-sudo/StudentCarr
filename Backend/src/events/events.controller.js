import { USER_EVENT_TYPES } from "./eventTypes.js";
import { initSseHeaders, sendSseComment, sendSseEvent } from "./sse.js";
import {
  subscribeUserEvents,
  unsubscribeUserEvents,
} from "./userEventHub.js";

const keepAliveIntervalMs = 20000;

const streamUserEvents = (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  initSseHeaders(res);
  subscribeUserEvents(userId, res);
  sendSseEvent(res, USER_EVENT_TYPES.CONNECTED, {
    message: "Event stream connected.",
    timestamp: new Date().toISOString(),
  });

  const keepAliveInterval = setInterval(() => {
    sendSseComment(res);
  }, keepAliveIntervalMs);

  const cleanup = () => {
    clearInterval(keepAliveInterval);
    unsubscribeUserEvents(userId, res);
  };

  req.on("aborted", cleanup);
  res.on("close", cleanup);
};

export { streamUserEvents };
