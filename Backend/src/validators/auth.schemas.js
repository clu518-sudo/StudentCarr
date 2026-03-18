const { z } = require("zod");

const signupSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
});

const validate = (schema, payload) => schema.parse(payload);

module.exports = {
  signupSchema,
  loginSchema,
  validate,
};
