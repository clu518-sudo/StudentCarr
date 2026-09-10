import { z } from "zod";

const sendMessageSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
  threadId: z.string().trim().min(1).optional(),
  // Present only when this turn was triggered by a quick-action chip; marks
  // that chip used-up for the thread once the turn succeeds. See chatLimits.js.
  quickActionId: z.string().trim().min(1).max(64).optional(),
});

const validate = (schema, payload) => schema.parse(payload);

export { sendMessageSchema, validate };