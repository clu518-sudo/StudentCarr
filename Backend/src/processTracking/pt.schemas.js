import { z } from "zod";

const idParamsSchema = z.object({
  id: z.string().trim().min(1, "Id is required"),
});

const applicationIdParamsSchema = z.object({
  applicationId: z.string().trim().min(1, "Application id is required"),
});

const confirmReplySchema = z.object({
  draftText: z.string().trim().min(1, "Draft text is required"),
});

const validate = (schema, payload) => schema.parse(payload);

export { idParamsSchema, applicationIdParamsSchema, confirmReplySchema, validate };
