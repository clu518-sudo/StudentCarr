import { z } from "zod";

const createApiSchema = z.object({
  label: z.string().trim().max(100).optional().or(z.literal("")),
});

const idParamsSchema = z.object({
  id: z.string().trim().min(1, "Key id is required"),
});

const validate = (schema, payload) => schema.parse(payload);

export { createApiSchema, idParamsSchema, validate };
