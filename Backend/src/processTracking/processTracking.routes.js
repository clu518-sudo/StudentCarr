import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  createGmailConnectSession,
  deleteApplications,
  disconnectGmail,
  listApplications,
  listApplicationEmails,
  getEmailDetail,
  getGmailStatus,
  getInviteReplyDraft,
  gmailOauthCallback,
  confirmInviteReply,
  syncProgressTracking,
} from "./pt.controller.js";

const router = Router();

router.get("/gmail/callback", gmailOauthCallback);

router.use(requireAuth);

router.get("/gmail/status", getGmailStatus);
router.post("/gmail/connect", createGmailConnectSession);
router.delete("/gmail/connect", disconnectGmail);
router.post("/sync", syncProgressTracking);
router.get("/applications", listApplications);
router.delete("/applications", deleteApplications);
router.get("/applications/:applicationId/emails", listApplicationEmails);
router.get("/emails/:id", getEmailDetail);
router.get("/emails/:id/reply-draft", getInviteReplyDraft);
router.post("/emails/:id/reply-confirm", confirmInviteReply);

export default router;
