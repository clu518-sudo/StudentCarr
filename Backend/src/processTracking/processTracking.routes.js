import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  listApplications,
  listApplicationEmails,
  getEmailDetail,
  getInviteReplyDraft,
  confirmInviteReply,
} from "./pt.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/applications", listApplications);
router.get("/applications/:applicationId/emails", listApplicationEmails);
router.get("/emails/:id", getEmailDetail);
router.get("/emails/:id/reply-draft", getInviteReplyDraft);
router.post("/emails/:id/reply-confirm", confirmInviteReply);

export default router;
