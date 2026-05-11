import {
  createApiSchema,
  idParamsSchema,
  validate,
} from "./apiKeys.schemas.js";
import * as apiKeyService from "./apiKeys.service.js";

// align error format
const formatZodError = (error) => {
  if (!error.issues) return "Invalid request payload";
  return error.issues
    .map((issue) => `${issue.path.join(".") || "fail"}: ${issue.message}`)
    .join(",");
};

// POST /api/key
// wraped create API key
const createApiKey = async (req, res, next) => {
  try {
    const payload = validate(createApiSchema, req.body);

    // req.user is set by requireAuth middleware
    const result = await apiKeyService.createApiKey({
      userId: req.user.id,
      label: payload.label,
    });

    return res.status(201).json({
      success: true,
      data: result, // data.key contains raw key and only should be shown once in UI
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

// GET api/keys
// wraped list hashed apiKeys
const listApiKeys = async (req, res, next) => {
  try {
    const data = await apiKeyService.listActiveApiKeys({
      userId: req.user.id,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/keys/:id
// delete(revoke) apikey
const revokeApiKey = async (req, res, next) => {
  try {
    const { id } = validate(idParamsSchema, req.params);

    const result = await apiKeyService.revokeApiKey({
      userId: req.user.id,
      keyId: id,
    });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: formatZodError(error),
      });
    }
    return next(error);
  }
};

export { createApiKey, listApiKeys, revokeApiKey };
