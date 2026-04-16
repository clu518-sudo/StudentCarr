import env from "../config/env.js";
import prisma from "../lib/prisma.js";
import {
  createGmailConnectUrlForUser,
  disconnectGmailAccountForUser,
  getFreshGmailAccessContextForUser,
  getGmailStatusForUser,
} from "./pt.gmail.js";

const AI_BASE_URL = String(env.progressTrackingServiceBaseUrl || "http://127.0.0.1:2024").replace(
  /\/$/,
  "",
);

const INTENT_TO_STATUS = {
  applied_confirmation: "applied",
  follow_up: "under_review",
  invite: "invited",
  rejection: "rejected",
  offer: "offer",
};

const TERMINAL_STATUSES = new Set(["offer", "rejected"]);

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const createHttpError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const toIsoDate = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toDisplayDate = (email) =>
  toIsoDate(email.receivedAt) ||
  toIsoDate(email.sentAt) ||
  toIsoDate(email.createdAt) ||
  new Date().toISOString();

const mapApplicationRecord = (application) => ({
  id: application.id,
  companyName: application.companyName,
  positionTitle: application.positionTitle,
  status: application.status || "under_review",
  lastUpdatedAt: toIsoDate(application.lastUpdatedAt) || new Date().toISOString(),
});

const mapEmailListItem = (email) => ({
  id: email.id,
  applicationId: email.applicationId,
  sender: email.sender,
  subject: email.subject,
  date: toDisplayDate(email),
  intent: email.intelligence?.intent || "unknown",
});

const mapEmailDetail = (email) => ({
  id: email.id,
  applicationId: email.applicationId,
  sender: email.sender,
  senderEmail: email.senderEmail || "",
  subject: email.subject,
  date: toDisplayDate(email),
  intent: email.intelligence?.intent || "unknown",
  body: email.rawBodyText || email.rawBodyHtml || email.snippet || "",
  summary: email.intelligence?.summary || "",
  companyName: email.intelligence?.companyName || "",
  positionTitle: email.intelligence?.positionTitle || "",
  contactEmail: email.intelligence?.contactEmail || "",
});

const buildAiUrl = (path) => `${AI_BASE_URL}${path}`;

const requestAiService = async (path, payload) => {
  let response;
  try {
    response = await fetch(buildAiUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw createHttpError(
      "Unable to reach the AI progress tracking service. Make sure AIServices is running.",
      502,
    );
  }

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(
      responseBody?.error || "AI progress tracking request failed.",
      response.status >= 400 ? response.status : 502,
    );
  }

  return responseBody?.data || {};
};

const resolveApplicationStatus = (existingStatus, suggestedStatus, intent) => {
  const candidateStatus = normalizeText(suggestedStatus) || INTENT_TO_STATUS[intent] || "";
  if (!candidateStatus) {
    return existingStatus || "under_review";
  }

  if (TERMINAL_STATUSES.has(existingStatus) && existingStatus !== candidateStatus) {
    return existingStatus;
  }

  return candidateStatus;
};

const selectApplicationRelation = {
  id: true,
  companyName: true,
  companyNameNormalized: true,
  positionTitle: true,
  positionTitleNormalized: true,
  status: true,
  contactEmail: true,
};

const ensureEmailBelongsToUser = async (userId, emailId) => {
  const email = await prisma.progressEmail.findFirst({
    where: { id: emailId, userId },
    include: {
      intelligence: true,
      application: {
        select: selectApplicationRelation,
      },
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!email) {
    throw createHttpError("Email not found", 404);
  }

  return email;
};

const upsertApplicationForExtraction = async (tx, { userId, gmailAccountId, extraction, emailDate }) => {
  const normalizedCompany = normalizeKey(extraction?.companyName);
  const normalizedPosition = normalizeKey(extraction?.positionTitle);

  if (!normalizedCompany || !normalizedPosition) {
    return null;
  }

  const existing = await tx.progressApplication.findUnique({
    where: {
      userId_companyNameNormalized_positionTitleNormalized: {
        userId,
        companyNameNormalized: normalizedCompany,
        positionTitleNormalized: normalizedPosition,
      },
    },
    select: {
      id: true,
      companyName: true,
      positionTitle: true,
      status: true,
      contactEmail: true,
    },
  });

  const nextStatus = resolveApplicationStatus(
    existing?.status || "",
    extraction?.suggestedApplicationStatus,
    extraction?.intent,
  );

  return tx.progressApplication.upsert({
    where: {
      userId_companyNameNormalized_positionTitleNormalized: {
        userId,
        companyNameNormalized: normalizedCompany,
        positionTitleNormalized: normalizedPosition,
      },
    },
    update: {
      gmailAccountId,
      companyName: normalizeText(extraction.companyName) || existing?.companyName || "Unknown Company",
      positionTitle:
        normalizeText(extraction.positionTitle) || existing?.positionTitle || "Unknown Position",
      contactEmail: normalizeText(extraction.contactEmail) || existing?.contactEmail || null,
      status: nextStatus,
      lastUpdatedAt: emailDate,
    },
    create: {
      userId,
      gmailAccountId,
      companyName: normalizeText(extraction.companyName) || "Unknown Company",
      companyNameNormalized: normalizedCompany,
      positionTitle: normalizeText(extraction.positionTitle) || "Unknown Position",
      positionTitleNormalized: normalizedPosition,
      contactEmail: normalizeText(extraction.contactEmail) || null,
      status: nextStatus,
      lastUpdatedAt: emailDate,
    },
  });
};

const persistSyncPayload = async ({ userId, gmailAccountId, syncStateId, syncPayload }) => {
  const messages = Array.isArray(syncPayload?.messages) ? syncPayload.messages : [];
  let processedMessages = 0;
  let upsertedApplications = 0;

  await prisma.$transaction(async (tx) => {
    for (const rawMessage of messages) {
      const message = rawMessage || {};
      if (!message.gmailMessageId) {
        continue;
      }

      const extraction = message.extraction || {};
      const emailDate =
        (message.receivedAt && new Date(message.receivedAt)) ||
        (message.sentAt && new Date(message.sentAt)) ||
        new Date();

      const application = await upsertApplicationForExtraction(tx, {
        userId,
        gmailAccountId,
        extraction,
        emailDate,
      });

      if (application) {
        upsertedApplications += 1;
      }

      const emailRecord = await tx.progressEmail.upsert({
        where: {
          gmailAccountId_gmailMessageId: {
            gmailAccountId,
            gmailMessageId: message.gmailMessageId,
          },
        },
        update: {
          applicationId: application?.id || null,
          gmailThreadId: normalizeText(message.gmailThreadId) || null,
          gmailHistoryId: normalizeText(message.gmailHistoryId) || null,
          subject: normalizeText(message.subject) || "(no subject)",
          sender: normalizeText(message.sender) || normalizeText(message.senderEmail) || "Unknown sender",
          senderEmail: normalizeText(message.senderEmail) || null,
          recipients: Array.isArray(message.recipients) ? message.recipients : [],
          ccRecipients: Array.isArray(message.ccRecipients) ? message.ccRecipients : [],
          bccRecipients: Array.isArray(message.bccRecipients) ? message.bccRecipients : [],
          snippet: normalizeText(message.snippet) || null,
          labelIds: Array.isArray(message.labelIds) ? message.labelIds : [],
          rawHeaders: Array.isArray(message.rawHeaders) ? message.rawHeaders : [],
          rawBodyText: normalizeText(message.rawBodyText) || null,
          rawBodyHtml: normalizeText(message.rawBodyHtml) || null,
          receivedAt: message.receivedAt ? new Date(message.receivedAt) : null,
          sentAt: message.sentAt ? new Date(message.sentAt) : null,
          isUnread: Boolean(message.isUnread),
          isRelevant:
            typeof message.isRelevant === "boolean"
              ? message.isRelevant
              : true,
          processingStage: normalizeText(message.processingStage) || "persisted",
          aiProcessedAt: new Date(),
          needsReplyDraft: Boolean(extraction.needsReplyDraft),
          replyRequiredAt: extraction.needsReplyDraft ? new Date() : null,
        },
        create: {
          userId,
          gmailAccountId,
          applicationId: application?.id || null,
          gmailMessageId: message.gmailMessageId,
          gmailThreadId: normalizeText(message.gmailThreadId) || null,
          gmailHistoryId: normalizeText(message.gmailHistoryId) || null,
          subject: normalizeText(message.subject) || "(no subject)",
          sender: normalizeText(message.sender) || normalizeText(message.senderEmail) || "Unknown sender",
          senderEmail: normalizeText(message.senderEmail) || null,
          recipients: Array.isArray(message.recipients) ? message.recipients : [],
          ccRecipients: Array.isArray(message.ccRecipients) ? message.ccRecipients : [],
          bccRecipients: Array.isArray(message.bccRecipients) ? message.bccRecipients : [],
          snippet: normalizeText(message.snippet) || null,
          labelIds: Array.isArray(message.labelIds) ? message.labelIds : [],
          rawHeaders: Array.isArray(message.rawHeaders) ? message.rawHeaders : [],
          rawBodyText: normalizeText(message.rawBodyText) || null,
          rawBodyHtml: normalizeText(message.rawBodyHtml) || null,
          receivedAt: message.receivedAt ? new Date(message.receivedAt) : null,
          sentAt: message.sentAt ? new Date(message.sentAt) : null,
          isUnread: Boolean(message.isUnread),
          isRelevant:
            typeof message.isRelevant === "boolean"
              ? message.isRelevant
              : true,
          processingStage: normalizeText(message.processingStage) || "persisted",
          aiProcessedAt: new Date(),
          needsReplyDraft: Boolean(extraction.needsReplyDraft),
          replyRequiredAt: extraction.needsReplyDraft ? new Date() : null,
        },
      });

      await tx.progressEmailIntelligence.upsert({
        where: { emailId: emailRecord.id },
        update: {
          summary: normalizeText(extraction.summary) || null,
          intent: normalizeText(extraction.intent) || "unknown",
          companyName: normalizeText(extraction.companyName) || null,
          positionTitle: normalizeText(extraction.positionTitle) || null,
          contactEmail: normalizeText(extraction.contactEmail) || null,
          confidence:
            typeof extraction.confidence === "number" ? extraction.confidence : null,
          needsReplyDraft: Boolean(extraction.needsReplyDraft),
          suggestedApplicationStatus:
            normalizeText(extraction.suggestedApplicationStatus) || null,
          extractedAt: new Date(),
        },
        create: {
          emailId: emailRecord.id,
          summary: normalizeText(extraction.summary) || null,
          intent: normalizeText(extraction.intent) || "unknown",
          companyName: normalizeText(extraction.companyName) || null,
          positionTitle: normalizeText(extraction.positionTitle) || null,
          contactEmail: normalizeText(extraction.contactEmail) || null,
          confidence:
            typeof extraction.confidence === "number" ? extraction.confidence : null,
          needsReplyDraft: Boolean(extraction.needsReplyDraft),
          suggestedApplicationStatus:
            normalizeText(extraction.suggestedApplicationStatus) || null,
        },
      });

      if (Boolean(extraction.needsReplyDraft) && normalizeText(message.draftReplyText)) {
        const latestReply = await tx.progressEmailReply.findFirst({
          where: { emailId: emailRecord.id },
          orderBy: { createdAt: "desc" },
        });

        if (!latestReply || latestReply.draftText !== normalizeText(message.draftReplyText)) {
          await tx.progressEmailReply.create({
            data: {
              userId,
              emailId: emailRecord.id,
              status: "drafted",
              draftText: normalizeText(message.draftReplyText),
            },
          });
        }
      }

      processedMessages += 1;
    }

    await tx.gmailAccount.update({
      where: { id: gmailAccountId },
      data: { lastSyncedAt: new Date() },
    });

    await tx.gmailSyncState.update({
      where: { id: syncStateId },
      data: {
        lastSyncStatus: "completed",
        lastSyncCompletedAt: new Date(),
        lastSyncError: null,
        firstSyncCompletedAt: new Date(),
        lastHistoryId: normalizeText(syncPayload?.lastHistoryId) || undefined,
      },
    });
  });

  return {
    processedMessages,
    upsertedApplications,
  };
};

const listApplicationsForUser = async (userId) => {
  const applications = await prisma.progressApplication.findMany({
    where: { userId },
    orderBy: { lastUpdatedAt: "desc" },
  });

  return {
    applications: applications.map(mapApplicationRecord),
  };
};

const deleteApplicationsForUser = async (userId, applicationIds) => {
  const uniqueApplicationIds = [...new Set((applicationIds || []).filter(Boolean))];
  if (!uniqueApplicationIds.length) {
    throw createHttpError("At least one application must be selected", 400);
  }

  const ownedApplications = await prisma.progressApplication.findMany({
    where: {
      userId,
      id: {
        in: uniqueApplicationIds,
      },
    },
    select: {
      id: true,
    },
  });

  const ownedApplicationIds = ownedApplications.map((application) => application.id);
  if (!ownedApplicationIds.length) {
    throw createHttpError("No matching applications were found for deletion", 404);
  }

  const emailRecords = await prisma.progressEmail.findMany({
    where: {
      userId,
      applicationId: {
        in: ownedApplicationIds,
      },
    },
    select: {
      id: true,
    },
  });

  const emailIds = emailRecords.map((email) => email.id);

  await prisma.$transaction(async (tx) => {
    if (emailIds.length) {
      await tx.progressEmailReply.deleteMany({
        where: {
          emailId: {
            in: emailIds,
          },
        },
      });

      await tx.progressEmailIntelligence.deleteMany({
        where: {
          emailId: {
            in: emailIds,
          },
        },
      });

      await tx.progressEmail.deleteMany({
        where: {
          id: {
            in: emailIds,
          },
        },
      });
    }

    await tx.progressApplication.deleteMany({
      where: {
        userId,
        id: {
          in: ownedApplicationIds,
        },
      },
    });
  });

  return {
    deletedApplicationIds: ownedApplicationIds,
    deletedApplicationsCount: ownedApplicationIds.length,
    deletedEmailsCount: emailIds.length,
  };
};

const listEmailsForApplication = async (userId, applicationId) => {
  const application = await prisma.progressApplication.findFirst({
    where: { id: applicationId, userId },
  });

  if (!application) {
    throw createHttpError("Application not found", 404);
  }

  const emails = await prisma.progressEmail.findMany({
    where: {
      userId,
      applicationId,
    },
    include: {
      intelligence: true,
    },
    orderBy: [{ receivedAt: "desc" }, { sentAt: "desc" }, { createdAt: "desc" }],
  });

  return {
    emails: emails.map(mapEmailListItem),
  };
};

const getEmailDetailById = async (userId, emailId) => {
  const email = await prisma.progressEmail.findFirst({
    where: { id: emailId, userId },
    include: {
      intelligence: true,
    },
  });

  if (!email) {
    throw createHttpError("Email not found", 404);
  }

  return {
    email: mapEmailDetail(email),
  };
};

const getInviteReplyDraftByEmailId = async (userId, emailId) => {
  const email = await ensureEmailBelongsToUser(userId, emailId);
  const intent = email.intelligence?.intent || "unknown";
  if (intent !== "invite") {
    throw createHttpError("Reply draft is only available for invite emails", 400);
  }

  const latestReply = email.replies[0];
  if (latestReply?.draftText) {
    return {
      draft: {
        emailId,
        draftText: latestReply.reviewedText || latestReply.draftText,
        source: "langgraph-ai",
        editable: true,
        status: latestReply.status,
      },
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true },
  });

  const aiDraft = await requestAiService("/progress-tracking/reply-draft", {
    user: {
      fullName: user?.fullName || "",
      email: user?.email || "",
    },
    email: {
      subject: email.subject,
      sender: email.sender,
      senderEmail: email.senderEmail || "",
      body: email.rawBodyText || email.rawBodyHtml || email.snippet || "",
      summary: email.intelligence?.summary || "",
      companyName: email.intelligence?.companyName || "",
      positionTitle: email.intelligence?.positionTitle || "",
    },
  });

  const draftText = normalizeText(aiDraft?.draftText);
  if (!draftText) {
    throw createHttpError("AI service returned an empty invite reply draft.", 502);
  }

  const savedReply = await prisma.progressEmailReply.create({
    data: {
      userId,
      emailId,
      status: "drafted",
      draftText,
    },
  });

  return {
    draft: {
      emailId,
      draftText: savedReply.draftText,
      source: "langgraph-ai",
      editable: true,
      status: savedReply.status,
    },
  };
};

const confirmInviteReplySend = async (userId, emailId, draftText) => {
  const email = await ensureEmailBelongsToUser(userId, emailId);
  const intent = email.intelligence?.intent || "unknown";
  if (intent !== "invite") {
    throw createHttpError("Only invite emails can be confirmed for reply", 400);
  }

  const trimmedDraft = normalizeText(draftText);
  if (!trimmedDraft) {
    throw createHttpError("Draft text is required", 400);
  }

  const { account, accessToken } = await getFreshGmailAccessContextForUser(userId);

  const pendingReply = await prisma.progressEmailReply.create({
    data: {
      userId,
      emailId,
      status: "reviewed",
      draftText: email.replies[0]?.draftText || trimmedDraft,
      reviewedText: trimmedDraft,
      confirmedAt: new Date(),
    },
  });

  try {
    const sendResult = await requestAiService("/progress-tracking/send-reply", {
      gmail: {
        accessToken,
        googleEmail: account.googleEmail,
      },
      email: {
        gmailThreadId: email.gmailThreadId || "",
        senderEmail: account.googleEmail,
        recipientEmail: email.senderEmail || email.intelligence?.contactEmail || "",
        subject: email.subject,
        body: email.rawBodyText || email.rawBodyHtml || email.snippet || "",
        draftText: trimmedDraft,
      },
    });

    const updatedReply = await prisma.progressEmailReply.update({
      where: { id: pendingReply.id },
      data: {
        status: "sent",
        reviewedText: trimmedDraft,
        sentAt: new Date(),
        sentMessageId: normalizeText(sendResult?.sentMessageId) || null,
        sentThreadId:
          normalizeText(sendResult?.threadId) || email.gmailThreadId || null,
      },
    });

    return {
      confirmation: {
        emailId,
        status: updatedReply.status,
        deliveryId: updatedReply.sentMessageId || updatedReply.id,
        confirmedAt: toIsoDate(updatedReply.confirmedAt) || new Date().toISOString(),
        confirmedDraftText: trimmedDraft,
      },
    };
  } catch (error) {
    await prisma.progressEmailReply.update({
      where: { id: pendingReply.id },
      data: {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Failed to send reply.",
      },
    });
    throw error;
  }
};

const getGmailConnectionStatusForUser = async (userId) =>
  getGmailStatusForUser(userId);

const createGmailConnectSessionForUser = async (user) =>
  createGmailConnectUrlForUser(user);

const disconnectGmailForUser = async (userId) =>
  disconnectGmailAccountForUser(userId);

const syncProgressTrackingForUser = async (userId) => {
  const { account, syncState, accessToken } = await getFreshGmailAccessContextForUser(userId);

  const applications = await prisma.progressApplication.findMany({
    where: { userId },
    select: selectApplicationRelation,
    orderBy: { lastUpdatedAt: "desc" },
  });

  const existingMessages = await prisma.progressEmail.findMany({
    where: { userId },
    select: {
      gmailMessageId: true,
      processingStage: true,
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  await prisma.gmailSyncState.update({
    where: { id: syncState.id },
    data: {
      lastSyncStatus: "running",
      lastSyncStartedAt: new Date(),
      lastSyncError: null,
    },
  });

  try {
    const aiResult = await requestAiService("/progress-tracking/sync", {
      gmail: {
        accessToken,
        googleEmail: account.googleEmail,
      },
      syncContext: {
        firstSyncCompletedAt: syncState.firstSyncCompletedAt,
        lastSyncCompletedAt: syncState.lastSyncCompletedAt,
        lastHistoryId: syncState.lastHistoryId || "",
        applications,
        knownMessageIds: existingMessages.map((item) => item.gmailMessageId),
        pendingMessageIds: existingMessages
          .filter((item) => item.processingStage !== "persisted")
          .map((item) => item.gmailMessageId),
      },
    });

    const persisted = await persistSyncPayload({
      userId,
      gmailAccountId: account.id,
      syncStateId: syncState.id,
      syncPayload: aiResult,
    });

    return {
      sync: {
        processedMessages: persisted.processedMessages,
        upsertedApplications: persisted.upsertedApplications,
        scannedMessages:
          typeof aiResult?.scannedMessages === "number" ? aiResult.scannedMessages : 0,
        relevantMessages:
          typeof aiResult?.relevantMessages === "number"
            ? aiResult.relevantMessages
            : persisted.processedMessages,
        firstSyncCompletedAt:
          syncState.firstSyncCompletedAt || new Date(),
      },
    };
  } catch (error) {
    await prisma.gmailSyncState.update({
      where: { id: syncState.id },
      data: {
        lastSyncStatus: "failed",
        lastSyncCompletedAt: new Date(),
        lastSyncError: error instanceof Error ? error.message : "Sync failed.",
      },
    });
    throw error;
  }
};

export {
  confirmInviteReplySend,
  createGmailConnectSessionForUser,
  deleteApplicationsForUser,
  disconnectGmailForUser,
  getEmailDetailById,
  getGmailConnectionStatusForUser,
  getInviteReplyDraftByEmailId,
  listApplicationsForUser,
  listEmailsForApplication,
  syncProgressTrackingForUser,
};
