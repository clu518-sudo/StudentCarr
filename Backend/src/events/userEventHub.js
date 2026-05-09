import { sendSseEvent } from "./sse.js";

const userSubscribers = new Map();

const subscribeUserEvents = (userId, res) => {
  if (!userId || !res) {
    return;
  }

  const normalizedUserId = String(userId);
  const subscribers = userSubscribers.get(normalizedUserId) || new Set();
  subscribers.add(res);
  userSubscribers.set(normalizedUserId, subscribers);
};

const unsubscribeUserEvents = (userId, res) => {
  if (!userId || !res) {
    return;
  }

  const normalizedUserId = String(userId);
  const subscribers = userSubscribers.get(normalizedUserId);
  if (!subscribers) {
    return;
  }

  subscribers.delete(res);
  if (!subscribers.size) {
    userSubscribers.delete(normalizedUserId);
  }
};

const emitUserEvent = (userId, eventName, payload = {}) => {
  if (!userId || !eventName) {
    return;
  }

  const normalizedUserId = String(userId);
  const subscribers = userSubscribers.get(normalizedUserId);
  if (!subscribers?.size) {
    return;
  }

  [...subscribers].forEach((res) => {
    try {
      sendSseEvent(res, eventName, payload);
    } catch {
      unsubscribeUserEvents(normalizedUserId, res);
    }
  });
};

export { emitUserEvent, subscribeUserEvents, unsubscribeUserEvents };
