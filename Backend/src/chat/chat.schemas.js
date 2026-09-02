import { z } from "zod";

const sendMessageSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
  threadId: z.string().trim().min(1).optional(),
});

const validate = (schema, payload) => schema.parse(payload);

export { sendMessageSchema, validate };