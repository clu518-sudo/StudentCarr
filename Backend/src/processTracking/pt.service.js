import env from "../config/env.js";
import prisma from "../lib/prisma.js";
import {
  createGmailConnectUrlForUser,
  disconnectGmailAccountForUser,
  getFreshGmailAccessContextForUser,
  getGmailStatusForUser,
} from "./pt.gmail.js";

const AI_BASE_URL = String(
  env.progressTrackingServiceBaseUrl || "http://127.0.0.1:10002",
).replace(/\/$/, "");

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

const formatDraftEmailText = (value) => {
  const normalized =
    typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  if (!normalized) {
    return "";
  }

  const withStructuralBreaks = normalized
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^Subject:[^\n]*\n*/im, "")
    .replace(/([.!?])\s+(Dear\b)/g, "$1\n\n$2")
    .replace(/([.!?])\s+(I look forward\b)/g, "$1\n\n$2")
    .replace(/([.!?])\s+(I will\b)/g, "$1\n\n$2")
    .replace(/([.!?])\s+(Best regards,?\b)/g, "$1\n\n$2")
    .replace(/([.!?])\s+(Kind regards,?\b)/g, "$1\n\n$2")
    .replace(/([.!?])\s+(Sincerely,?\b)/g, "$1\n\n$2")
    .replace(/([.!?])\s+(Thanks again,?\b)/g, "$1\n\n$2")
    .replace(
      /(Best regards,?|Kind regards,?|Sincerely,?|Regards,?)\s+([A-Z][A-Za-z' -]+)$/m,
      "$1\n$2",
    );

  const lines = withStructuralBreaks
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, allLines) => line || allLines[index - 1] !== "");

  return lines.join("\n");
};

const normalizeKey = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeMessageId = (value) => {
  const trimmed = normalizeText(value);
  if (!trimmed) {
    return "";
  }
  const wrapped = trimmed.match(/<([^>]+)>/);
  if (wrapped?.[1]) {
    return wrapped[1].trim().toLowerCase();
  }
  return trimmed.replace(/^<|>$/g, "").trim().toLowerCase();
};

const normalizeReferencesHeader = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => normalizeMessageId(entry)).filter(Boolean);
};

const shouldTreatAsRootMessage = (message) => {
  const hasParentHint =
    Boolean(normalizeText(message.parentGmailMessageId)) ||
    Boolean(normalizeText(message.parentRfcMessageId)) ||
    Boolean(normalizeText(message.inReplyTo)) ||
    normalizeReferencesHeader(message.referencesHeader).length > 0;
  return !hasParentHint;
};

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

const toThreadTimestamp = (email) => {
  const dateValue = toDisplayDate(email);
  const parsed = new Date(dateValue).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toMessageBody = (email) =>
  email.rawBodyText || email.rawBodyHtml || email.snippet || "";

const sortEmailsChronologically = (emails) =>
  [...emails].sort((left, right) => {
    const threadPositionLeft =
      typeof left.threadPosition === "number"
        ? left.threadPosition
        : Number.MAX_SAFE_INTEGER;
    const threadPositionRight =
      typeof right.threadPosition === "number"
        ? right.threadPosition
        : Number.MAX_SAFE_INTEGER;
    if (threadPositionLeft !== threadPositionRight) {
      return threadPositionLeft - threadPositionRight;
    }
    const leftTime = toThreadTimestamp(left);
    const rightTime = toThreadTimestamp(right);
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return (left.id || "").localeCompare(right.id || "");
  });

const mapApplicationRecord = (application) => ({
  id: application.id,
  companyName: application.companyName,
  positionTitle: application.positionTitle,
  status: application.status || "under_review",
  lastUpdatedAt:
    toIsoDate(application.lastUpdatedAt) || new Date().toISOString(),
});

const mapEmailListItem = (email) => ({
  id: email.id,
  applicationId: email.applicationId,
  sender: email.sender,
  subject: email.subject,
  date: toDisplayDate(email),
  intent: email.intelligence?.intent || "unknown",
  replyCount:
    typeof email._count?.childReplies === "number"
      ? email._count.childReplies
      : 0,
});

const mapEmailThreadReply = (email, depth = 1) => ({
  id: email.id,
  parentEmailId: email.parentEmailId || null,
  depth,
  sender: email.sender,
  senderEmail: email.senderEmail || "",
  subject: email.subject,
  date: toDisplayDate(email),
  intent: email.intelligence?.intent || "unknown",
  body: toMessageBody(email),
  summary: email.intelligence?.summary || "",
  companyName: email.intelligence?.companyName || "",
  positionTitle: email.intelligence?.positionTitle || "",
  contactEmail: email.intelligence?.contactEmail || "",
  threadPosition:
    typeof email.threadPosition === "number" ? email.threadPosition : null,
});

const mapEmailDetail = (email, replies = []) => ({
  id: email.id,
  applicationId: email.applicationId,
  sender: email.sender,
  senderEmail: email.senderEmail || "",
  subject: email.subject,
  date: toDisplayDate(email),
  intent: email.intelligence?.intent || "unknown",
  body: toMessageBody(email),
  summary: email.intelligence?.summary || "",
  companyName: email.intelligence?.companyName || "",
  positionTitle: email.intelligence?.positionTitle || "",
  contactEmail: email.intelligence?.contactEmail || "",
  replyCount: replies.length,
  replies,
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
  const candidateStatus =
    normalizeText(suggestedStatus) || INTENT_TO_STATUS[intent] || "";
  if (!candidateStatus) {
    return existingStatus || "under_review";
  }

  if (
    TERMINAL_STATUSES.has(existingStatus) &&
    existingStatus !== candidateStatus
  ) {
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

const resolveRootEmailForUser = async (userId, email) => {
  let current = email;
  const visited = new Set([email.id]);

  while (current?.parentEmailId) {
    const parent = await prisma.progressEmail.findFirst({
      where: { id: current.parentEmailId, userId },
      include: {
        intelligence: true,
      },
    });
    if (!parent || visited.has(parent.id)) {
      break;
    }
    visited.add(parent.id);
    current = parent;
  }

  return current;
};

const loadThreadReplyRecordsForRoot = async (userId, rootEmailId) => {
  const allReplies = [];
  const depthByEmailId = new Map([[rootEmailId, 0]]);
  let parentIds = [rootEmailId];

  while (parentIds.length) {
    const childEmails = await prisma.progressEmail.findMany({
      where: {
        userId,
        parentEmailId: {
          in: parentIds,
        },
      },
      include: {
        intelligence: true,
      },
      orderBy: [
        { threadPosition: "asc" },
        { receivedAt: "asc" },
        { sentAt: "asc" },
        { createdAt: "asc" },
      ],
    });

    if (!childEmails.length) {
      break;
    }

    allReplies.push(...childEmails);
    parentIds = childEmails.map((email) => email.id);
    for (const childEmail of childEmails) {
      const parentDepth =
        depthByEmailId.get(childEmail.parentEmailId || "") || 0;
      depthByEmailId.set(childEmail.id, parentDepth + 1);
    }
  }

  return {
    orderedReplies: sortEmailsChronologically(allReplies),
    depthByEmailId,
  };
};

const loadThreadRepliesForRoot = async (userId, rootEmailId) => {
  const { orderedReplies, depthByEmailId } =
    await loadThreadReplyRecordsForRoot(userId, rootEmailId);
  return orderedReplies.map((reply) =>
    mapEmailThreadReply(reply, depthByEmailId.get(reply.id) || 1),
  );
};

const buildConversationMessagesForAi = (rootEmail, replyRows) =>
  sortEmailsChronologically([rootEmail, ...replyRows]).map((message) => ({
    subject: message.subject || "",
    sender: message.sender || "",
    senderEmail: message.senderEmail || "",
    date: toDisplayDate(message),
    body: toMessageBody(message),
  }));

const upsertApplicationForExtraction = async (
  tx,
  { userId, gmailAccountId, extraction, emailDate },
) => {
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
      companyName:
        normalizeText(extraction.companyName) ||
        existing?.companyName ||
        "Unknown Company",
      positionTitle:
        normalizeText(extraction.positionTitle) ||
        existing?.positionTitle ||
        "Unknown Position",
      contactEmail:
        normalizeText(extraction.contactEmail) ||
        existing?.contactEmail ||
        null,
      status: nextStatus,
      lastUpdatedAt: emailDate,
    },
    create: {
      userId,
      gmailAccountId,
      companyName: normalizeText(extraction.companyName) || "Unknown Company",
      companyNameNormalized: normalizedCompany,
      positionTitle:
        normalizeText(extraction.positionTitle) || "Unknown Position",
      positionTitleNormalized: normalizedPosition,
      contactEmail: normalizeText(extraction.contactEmail) || null,
      status: nextStatus,
      lastUpdatedAt: emailDate,
    },
  });
};

const persistSyncPayload = async ({
  userId,
  gmailAccountId,
  syncStateId,
  syncPayload,
}) => {
  const messages = Array.isArray(syncPayload?.messages)
    ? syncPayload.messages
    : [];
  let processedMessages = 0;
  let upsertedApplications = 0;
  const persistedEmailMetadata = [];

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

      const matchedApplicationId = normalizeText(message.matchedApplicationId);
      const matchedApplication = matchedApplicationId
        ? await tx.progressApplication.findFirst({
            where: {
              id: matchedApplicationId,
              userId,
            },
            select: { id: true },
          })
        : null;
      const resolvedApplicationId =
        matchedApplication?.id || application?.id || null;

      const normalizedRfcMessageId = normalizeMessageId(message.rfcMessageId);
      const normalizedInReplyTo = normalizeMessageId(message.inReplyTo);
      const normalizedReferencesHeader = normalizeReferencesHeader(
        message.referencesHeader,
      );

      const emailRecord = await tx.progressEmail.upsert({
        where: {
          gmailAccountId_gmailMessageId: {
            gmailAccountId,
            gmailMessageId: message.gmailMessageId,
          },
        },
        update: {
          applicationId: resolvedApplicationId,
          gmailThreadId: normalizeText(message.gmailThreadId) || null,
          gmailHistoryId: normalizeText(message.gmailHistoryId) || null,
          rfcMessageId: normalizedRfcMessageId || null,
          inReplyTo: normalizedInReplyTo || null,
          referencesHeader: normalizedReferencesHeader.length
            ? normalizedReferencesHeader
            : [],
          threadPosition:
            typeof message.threadPosition === "number"
              ? message.threadPosition
              : null,
          subject: normalizeText(message.subject) || "(no subject)",
          sender:
            normalizeText(message.sender) ||
            normalizeText(message.senderEmail) ||
            "Unknown sender",
          senderEmail: normalizeText(message.senderEmail) || null,
          recipients: Array.isArray(message.recipients)
            ? message.recipients
            : [],
          ccRecipients: Array.isArray(message.ccRecipients)
            ? message.ccRecipients
            : [],
          bccRecipients: Array.isArray(message.bccRecipients)
            ? message.bccRecipients
            : [],
          snippet: normalizeText(message.snippet) || null,
          labelIds: Array.isArray(message.labelIds) ? message.labelIds : [],
          rawHeaders: Array.isArray(message.rawHeaders)
            ? message.rawHeaders
            : [],
          rawBodyText: normalizeText(message.rawBodyText) || null,
          rawBodyHtml: normalizeText(message.rawBodyHtml) || null,
          receivedAt: message.receivedAt ? new Date(message.receivedAt) : null,
          sentAt: message.sentAt ? new Date(message.sentAt) : null,
          isUnread: Boolean(message.isUnread),
          isRelevant:
            typeof message.isRelevant === "boolean" ? message.isRelevant : true,
          processingStage:
            normalizeText(message.processingStage) || "persisted",
          aiProcessedAt: new Date(),
          needsReplyDraft: Boolean(extraction.needsReplyDraft),
          replyRequiredAt: extraction.needsReplyDraft ? new Date() : null,
        },
        create: {
          userId,
          gmailAccountId,
          applicationId: resolvedApplicationId,
          gmailMessageId: message.gmailMessageId,
          gmailThreadId: normalizeText(message.gmailThreadId) || null,
          gmailHistoryId: normalizeText(message.gmailHistoryId) || null,
          rfcMessageId: normalizedRfcMessageId || null,
          inReplyTo: normalizedInReplyTo || null,
          referencesHeader: normalizedReferencesHeader.length
            ? normalizedReferencesHeader
            : [],
          threadPosition:
            typeof message.threadPosition === "number"
              ? message.threadPosition
              : null,
          subject: normalizeText(message.subject) || "(no subject)",
          sender:
            normalizeText(message.sender) ||
            normalizeText(message.senderEmail) ||
            "Unknown sender",
          senderEmail: normalizeText(message.senderEmail) || null,
          recipients: Array.isArray(message.recipients)
            ? message.recipients
            : [],
          ccRecipients: Array.isArray(message.ccRecipients)
            ? message.ccRecipients
            : [],
          bccRecipients: Array.isArray(message.bccRecipients)
            ? message.bccRecipients
            : [],
          snippet: normalizeText(message.snippet) || null,
          labelIds: Array.isArray(message.labelIds) ? message.labelIds : [],
          rawHeaders: Array.isArray(message.rawHeaders)
            ? message.rawHeaders
            : [],
          rawBodyText: normalizeText(message.rawBodyText) || null,
          rawBodyHtml: normalizeText(message.rawBodyHtml) || null,
          receivedAt: message.receivedAt ? new Date(message.receivedAt) : null,
          sentAt: message.sentAt ? new Date(message.sentAt) : null,
          isUnread: Boolean(message.isUnread),
          isRelevant:
            typeof message.isRelevant === "boolean" ? message.isRelevant : true,
          processingStage:
            normalizeText(message.processingStage) || "persisted",
          aiProcessedAt: new Date(),
          needsReplyDraft: Boolean(extraction.needsReplyDraft),
          replyRequiredAt: extraction.needsReplyDraft ? new Date() : null,
        },
      });

      persistedEmailMetadata.push({
        emailId: emailRecord.id,
        gmailMessageId: normalizeText(message.gmailMessageId),
        parentGmailMessageId: normalizeText(message.parentGmailMessageId),
        parentRfcMessageId: normalizeMessageId(message.parentRfcMessageId),
        inReplyTo: normalizedInReplyTo,
        referencesHeader: normalizedReferencesHeader,
        rfcMessageId: normalizedRfcMessageId,
        isRootCandidate: shouldTreatAsRootMessage(message),
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
            typeof extraction.confidence === "number"
              ? extraction.confidence
              : null,
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
            typeof extraction.confidence === "number"
              ? extraction.confidence
              : null,
          needsReplyDraft: Boolean(extraction.needsReplyDraft),
          suggestedApplicationStatus:
            normalizeText(extraction.suggestedApplicationStatus) || null,
        },
      });

      if (
        Boolean(extraction.needsReplyDraft) &&
        normalizeText(message.draftReplyText)
      ) {
        const latestReply = await tx.progressEmailReply.findFirst({
          where: { emailId: emailRecord.id },
          orderBy: { createdAt: "desc" },
        });

        if (
          !latestReply ||
          latestReply.draftText !== normalizeText(message.draftReplyText)
        ) {
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

    const candidateGmailMessageIds = [
      ...new Set(
        persistedEmailMetadata.flatMap((item) =>
          [item.gmailMessageId, item.parentGmailMessageId].filter(Boolean),
        ),
      ),
    ];
    const candidateRfcMessageIds = [
      ...new Set(
        persistedEmailMetadata.flatMap((item) =>
          [
            item.rfcMessageId,
            item.parentRfcMessageId,
            item.inReplyTo,
            ...(Array.isArray(item.referencesHeader)
              ? item.referencesHeader
              : []),
          ].filter(Boolean),
        ),
      ),
    ];

    const lookupEmails =
      candidateGmailMessageIds.length || candidateRfcMessageIds.length
        ? await tx.progressEmail.findMany({
            where: {
              gmailAccountId,
              OR: [
                ...(candidateGmailMessageIds.length
                  ? [{ gmailMessageId: { in: candidateGmailMessageIds } }]
                  : []),
                ...(candidateRfcMessageIds.length
                  ? [{ rfcMessageId: { in: candidateRfcMessageIds } }]
                  : []),
              ],
            },
            select: {
              id: true,
              gmailMessageId: true,
              rfcMessageId: true,
            },
          })
        : [];

    const byGmailMessageId = new Map(
      lookupEmails.map((email) => [
        normalizeText(email.gmailMessageId),
        email.id,
      ]),
    );
    const byRfcMessageId = new Map(
      lookupEmails
        .filter((email) => normalizeMessageId(email.rfcMessageId))
        .map((email) => [normalizeMessageId(email.rfcMessageId), email.id]),
    );

    for (const item of persistedEmailMetadata) {
      let parentEmailId = "";
      if (item.parentGmailMessageId) {
        parentEmailId = byGmailMessageId.get(item.parentGmailMessageId) || "";
      }
      if (!parentEmailId && item.parentRfcMessageId) {
        parentEmailId = byRfcMessageId.get(item.parentRfcMessageId) || "";
      }
      if (!parentEmailId && item.inReplyTo) {
        parentEmailId = byRfcMessageId.get(item.inReplyTo) || "";
      }
      if (!parentEmailId && item.referencesHeader.length) {
        for (const referenceId of [...item.referencesHeader].reverse()) {
          const candidateParentId = byRfcMessageId.get(referenceId) || "";
          if (candidateParentId) {
            parentEmailId = candidateParentId;
            break;
          }
        }
      }

      if (parentEmailId && parentEmailId !== item.emailId) {
        await tx.progressEmail.update({
          where: { id: item.emailId },
          data: { parentEmailId },
        });
      } else if (item.isRootCandidate) {
        await tx.progressEmail.update({
          where: { id: item.emailId },
          data: { parentEmailId: null },
        });
      }

      if (item.rfcMessageId) {
        await tx.progressEmail.updateMany({
          where: {
            gmailAccountId,
            id: { not: item.emailId },
            parentEmailId: null,
            inReplyTo: item.rfcMessageId,
          },
          data: { parentEmailId: item.emailId },
        });
      }
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
  const uniqueApplicationIds = [
    ...new Set((applicationIds || []).filter(Boolean)),
  ];
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

  const ownedApplicationIds = ownedApplications.map(
    (application) => application.id,
  );
  if (!ownedApplicationIds.length) {
    throw createHttpError(
      "No matching applications were found for deletion",
      404,
    );
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
      parentEmailId: null,
    },
    include: {
      intelligence: true,
      _count: {
        select: {
          childReplies: true,
        },
      },
    },
    orderBy: [
      { receivedAt: "desc" },
      { sentAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  return {
    emails: emails.map(mapEmailListItem),
  };
};

const getEmailDetailById = async (userId, emailId) => {
  const selectedEmail = await prisma.progressEmail.findFirst({
    where: { id: emailId, userId },
    include: {
      intelligence: true,
    },
  });

  if (!selectedEmail) {
    throw createHttpError("Email not found", 404);
  }

  const rootEmail = await resolveRootEmailForUser(userId, selectedEmail);
  const replyRows = await loadThreadRepliesForRoot(userId, rootEmail.id);

  return {
    email: mapEmailDetail(rootEmail, replyRows),
  };
};

const getInviteReplyDraftByEmailId = async (userId, emailId) => {
  const selectedEmail = await ensureEmailBelongsToUser(userId, emailId);
  const rootEmail = await resolveRootEmailForUser(userId, selectedEmail);
  const intent = rootEmail.intelligence?.intent || "unknown";
  if (intent !== "invite") {
    throw createHttpError(
      "Reply draft is only available for invite emails",
      400,
    );
  }

  const latestReply = await prisma.progressEmailReply.findFirst({
    where: { emailId: rootEmail.id },
    orderBy: { createdAt: "desc" },
  });
  if (latestReply?.draftText) {
    const formattedDraft = formatDraftEmailText(
      latestReply.reviewedText || latestReply.draftText,
    );
    return {
      draft: {
        emailId: rootEmail.id,
        draftText: formattedDraft,
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
  const { orderedReplies } = await loadThreadReplyRecordsForRoot(
    userId,
    rootEmail.id,
  );
  const conversationMessages = buildConversationMessagesForAi(
    rootEmail,
    orderedReplies,
  );

  const aiDraft = await requestAiService("/progress-tracking/reply-draft", {
    user: {
      fullName: user?.fullName || "",
      email: user?.email || "",
    },
    email: {
      subject: rootEmail.subject,
      sender: rootEmail.sender,
      senderEmail: rootEmail.senderEmail || "",
      body: toMessageBody(rootEmail),
      summary: rootEmail.intelligence?.summary || "",
      companyName: rootEmail.intelligence?.companyName || "",
      positionTitle: rootEmail.intelligence?.positionTitle || "",
    },
    conversationMessages,
  });

  const draftText = formatDraftEmailText(aiDraft?.draftText);
  if (!draftText) {
    throw createHttpError(
      "AI service returned an empty invite reply draft.",
      502,
    );
  }

  const savedReply = await prisma.progressEmailReply.create({
    data: {
      userId,
      emailId: rootEmail.id,
      status: "drafted",
      draftText,
    },
  });

  return {
    draft: {
      emailId: rootEmail.id,
      draftText: savedReply.draftText,
      source: "langgraph-ai",
      editable: true,
      status: savedReply.status,
    },
  };
};

const confirmInviteReplySend = async (userId, emailId, draftText) => {
  const selectedEmail = await ensureEmailBelongsToUser(userId, emailId);
  const rootEmail = await resolveRootEmailForUser(userId, selectedEmail);
  const intent = rootEmail.intelligence?.intent || "unknown";
  if (intent !== "invite") {
    throw createHttpError("Only invite emails can be confirmed for reply", 400);
  }

  const trimmedDraft = formatDraftEmailText(draftText);
  if (!trimmedDraft) {
    throw createHttpError("Draft text is required", 400);
  }

  const { account, accessToken } =
    await getFreshGmailAccessContextForUser(userId);
  const latestReplyForRoot = await prisma.progressEmailReply.findFirst({
    where: { emailId: rootEmail.id },
    orderBy: { createdAt: "desc" },
  });
  const { orderedReplies } = await loadThreadReplyRecordsForRoot(
    userId,
    rootEmail.id,
  );
  const conversationRows = sortEmailsChronologically([
    rootEmail,
    ...orderedReplies,
  ]);
  const latestThreadMessage =
    conversationRows[conversationRows.length - 1] || rootEmail;
  const replyReferences = [
    ...new Set(
      [
        ...normalizeReferencesHeader(latestThreadMessage.referencesHeader),
        normalizeMessageId(latestThreadMessage.rfcMessageId),
      ].filter(Boolean),
    ),
  ];

  const pendingReply = await prisma.progressEmailReply.create({
    data: {
      userId,
      emailId: rootEmail.id,
      status: "reviewed",
      draftText: latestReplyForRoot?.draftText || trimmedDraft,
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
        gmailThreadId: rootEmail.gmailThreadId || "",
        senderEmail: account.googleEmail,
        recipientEmail:
          latestThreadMessage.senderEmail ||
          rootEmail.senderEmail ||
          rootEmail.intelligence?.contactEmail ||
          "",
        subject: rootEmail.subject,
        body: toMessageBody(latestThreadMessage),
        draftText: trimmedDraft,
        inReplyTo: normalizeMessageId(latestThreadMessage.rfcMessageId),
        referencesHeader: replyReferences,
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
          normalizeText(sendResult?.threadId) ||
          rootEmail.gmailThreadId ||
          null,
      },
    });

    return {
      confirmation: {
        emailId: rootEmail.id,
        status: updatedReply.status,
        deliveryId: updatedReply.sentMessageId || updatedReply.id,
        confirmedAt:
          toIsoDate(updatedReply.confirmedAt) || new Date().toISOString(),
        confirmedDraftText: trimmedDraft,
      },
    };
  } catch (error) {
    await prisma.progressEmailReply.update({
      where: { id: pendingReply.id },
      data: {
        status: "failed",
        errorMessage:
          error instanceof Error ? error.message : "Failed to send reply.",
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
  const { account, syncState, accessToken } =
    await getFreshGmailAccessContextForUser(userId);

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
          typeof aiResult?.scannedMessages === "number"
            ? aiResult.scannedMessages
            : 0,
        relevantMessages:
          typeof aiResult?.relevantMessages === "number"
            ? aiResult.relevantMessages
            : persisted.processedMessages,
        firstSyncCompletedAt: syncState.firstSyncCompletedAt || new Date(),
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
