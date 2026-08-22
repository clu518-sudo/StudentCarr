import { z } from "zod";

const saveLlmKeySchema = z.object({
  label: z.string().trim().max(80).optional().or(z.literal("")),
  apiKey: z.string().trim().min(20, "API key looks too short"),
  provider: z.string().trim().max(50).optional().or(z.literal("")),
  model: z.string().trim().max(100).optional().or(z.literal("")),
  baseUrl: z
    .string()
    .trim()
    .url("Base URL must be a valid URL")
    .max(300)
    .optional()
    .or(z.literal("")),
});

const idParamsSchema = z.object({
  id: z.string().trim().min(1, "Setting id is required"),
});

const validate = (schema, payload) => schema.parse(payload);

export { saveLlmKeySchema, idParamsSchema, validate };