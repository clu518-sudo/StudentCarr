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

const deleteApplicationsSchema = z.object({
  applicationIds: z
    .array(z.string().trim().min(1, "Application id is required"))
    .min(1, "At least one application must be selected"),
});

const gmailCallbackQuerySchema = z.object({
  code: z.string().trim().optional(),
  state: z.string().trim().optional(),
  error: z.string().trim().optional(),
});

const validate = (schema, payload) => schema.parse(payload);

export {
  applicationIdParamsSchema,
  confirmReplySchema,
  deleteApplicationsSchema,
  gmailCallbackQuerySchema,
  idParamsSchema,
  validate,
};
