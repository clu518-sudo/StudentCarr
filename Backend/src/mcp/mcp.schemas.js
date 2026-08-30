import { z } from "zod";

// Tool arguments arrive from an LLM, which sometimes stringifies numbers.
const mcpApplicationEmailsSchema = z.object({
    applicationId: z.string().trim().min(1).optional(),
    intent: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    cursor: z.string().trim().min(1).optional(),
});

const mcpEmailDetailSchema = z.object({
    emailId: z.string().trim().min(1, "emailId is required"),
});

const validate = (schema, payload) => schema.parse(payload);

export {
    mcpApplicationEmailsSchema,
    mcpEmailDetailSchema,
    validate,
};
