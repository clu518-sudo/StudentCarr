import { z } from "zod";

const mcpDispatcherSchema = z.object({
    message: z.string().trim().min(1, "Message is required"),
});

const validate = (schema, payload) => schema.parse(payload);

export {
    mcpDispatcherSchema,
    validate,
};