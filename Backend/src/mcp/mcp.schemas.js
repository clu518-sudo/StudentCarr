import { z } from "zod";

const mcpProcessTrackingSchema = z.object({
    message: z.string().trim().min(1, "Message is required"),
});

const validate = (schema, payload) => schema.parse(payload);

export {
    mcpProcessTrackingSchema,
    validate,
};