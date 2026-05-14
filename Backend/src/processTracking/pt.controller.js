import {
  idParamsSchema,
  applicationIdParamsSchema,
  confirmReplySchema,
  deleteApplicationsSchema,
  gmailCallbackQuerySchema,
  validate,
} from "./pt.schemas.js";
import {
  createGmailConnectSessionForUser,
  deleteApplicationsForUser,
  disconnectGmailForUser,
  getGmailConnectionStatusForUser,
  listApplicationsForUser,
  listEmailsForApplication,
  getEmailDetailById,
  getInviteReplyDraftByEmailId,
  confirmInviteReplySend,
  syncProgressTrackingForUser,
} from "./pt.service.js";
import { handleGmailOAuthCallback } from "./pt.gmail.js";

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

const deleteApplications = async (req, res, next) => {
  try {
    const payload = validate(deleteApplicationsSchema, req.body || {});
    const result = await deleteApplicationsForUser(
      req.user.id,
      payload.applicationIds,
    );
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const listApplicationEmails = async (req, res, next) => {
  try {
    const { applicationId } = validate(applicationIdParamsSchema, req.params);
    const result = await listEmailsForApplication(req.user.id, applicationId);
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const getEmailDetail = async (req, res, next) => {
  try {
    const { id } = validate(idParamsSchema, req.params);
    const result = await getEmailDetailById(req.user.id, id);
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const getInviteReplyDraft = async (req, res, next) => {
  try {
    const { id } = validate(idParamsSchema, req.params);
    const result = await getInviteReplyDraftByEmailId(req.user.id, id);
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const confirmInviteReply = async (req, res, next) => {
  try {
    const { id } = validate(idParamsSchema, req.params);
    const payload = validate(confirmReplySchema, req.body || {});
    const result = await confirmInviteReplySend(
      req.user.id,
      id,
      payload.draftText,
    );
    return res.json({ success: true, data: result });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const getGmailStatus = async (req, res, next) => {
  try {
    const result = await getGmailConnectionStatusForUser(req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const createGmailConnectSession = async (req, res, next) => {
  try {
    if (req.user?.authProvider === "google") {
      return res.status(400).json({
        success: false,
        error:
          "Manual Gmail connect is disabled for users logged in with Google.",
      });
    }
    const result = await createGmailConnectSessionForUser(req.user);
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const gmailOauthCallback = async (req, res, next) => {
  try {
    const query = validate(gmailCallbackQuerySchema, req.query || {});
    const result = await handleGmailOAuthCallback(query);
    return res.redirect(result.redirectUrl);
  } catch (error) {
    return next(error);
  }
};

const disconnectGmail = async (req, res, next) => {
  try {
    const result = await disconnectGmailForUser(req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const syncProgressTracking = async (req, res, next) => {
  try {
    const result = await syncProgressTrackingForUser(req.user.id);
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

export {
  createGmailConnectSession,
  deleteApplications,
  listApplications,
  listApplicationEmails,
  getEmailDetail,
  getInviteReplyDraft,
  confirmInviteReply,
  disconnectGmail,
  getGmailStatus,
  gmailOauthCallback,
  syncProgressTracking,
};
