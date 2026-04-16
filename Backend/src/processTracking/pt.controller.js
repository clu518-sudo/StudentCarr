import {
  idParamsSchema,
  applicationIdParamsSchema,
  confirmReplySchema,
  validate,
} from "./pt.schemas.js";
import {
  listApplicationsForUser,
  listEmailsForApplication,
  getEmailDetailById,
  getInviteReplyDraftByEmailId,
  confirmInviteReplySend,
} from "./pt.service.js";

const formatZodError = (error) => {
  if (!error?.issues) {
    return "Invalid request payload";
  }

  return error.issues
    .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
    .join(", ");
};

const listApplications = async (req, res, next) => {
  try {
    const result = await listApplicationsForUser(req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const listApplicationEmails = async (req, res, next) => {
  try {
    const { applicationId } = validate(applicationIdParamsSchema, req.params);
    const result = await listEmailsForApplication(applicationId);
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const getEmailDetail = async (req, res, next) => {
  try {
    const { id } = validate(idParamsSchema, req.params);
    const result = await getEmailDetailById(id);
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const getInviteReplyDraft = async (req, res, next) => {
  try {
    const { id } = validate(idParamsSchema, req.params);
    const result = await getInviteReplyDraftByEmailId(id);
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const confirmInviteReply = async (req, res, next) => {
  try {
    const { id } = validate(idParamsSchema, req.params);
    const payload = validate(confirmReplySchema, req.body || {});
    const result = await confirmInviteReplySend(req.user.id, id, payload.draftText);
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

export {
  listApplications,
  listApplicationEmails,
  getEmailDetail,
  getInviteReplyDraft,
  confirmInviteReply,
};
