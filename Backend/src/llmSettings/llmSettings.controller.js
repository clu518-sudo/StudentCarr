import { saveLlmKeySchema, idParamsSchema, validate } from "./llmSettings.schemas.js";
import * as llmSettingsService from "./llmSettings.service.js";

const formatZodError = (error) => {
  if (!error?.issues) return "Invalid request payload";
  return error.issues
    .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
    .join(", ");
};

const listLlmKeys = async (req, res, next) => {
  try {
    const data = await llmSettingsService.listLlmKeys({ userId: req.user.id });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const createLlmKey = async (req, res, next) => {
  try {
    const payload = validate(saveLlmKeySchema, req.body || {});
    const data = await llmSettingsService.createLlmKey({
      userId: req.user.id,
      label: payload.label,
      apiKey: payload.apiKey,
      provider: payload.provider,
      model: payload.model,
      baseUrl: payload.baseUrl,
    });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const selectLlmKey = async (req, res, next) => {
  try {
    const { id } = validate(idParamsSchema, req.params);
    const data = await llmSettingsService.selectLlmKey({ userId: req.user.id, id });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const deleteLlmKey = async (req, res, next) => {
  try {
    const { id } = validate(idParamsSchema, req.params);
    const data = await llmSettingsService.deleteLlmKey({ userId: req.user.id, id });
    return res.json({ success: true, data });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

export { listLlmKeys, createLlmKey, selectLlmKey, deleteLlmKey };
