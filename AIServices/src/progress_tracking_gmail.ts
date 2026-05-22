import { google, gmail_v1 } from "googleapis";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const OPENAI_MODEL =
  process.env.OPENAI_MODEL || process.env.MODEL || "gpt-4.1-mini";
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 45000);
const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 2);
const GMAIL_MAX_CANDIDATES = Number(
  process.env.GMAIL_SYNC_MAX_CANDIDATES || 30,
);
const GMAIL_FIRST_SYNC_QUERY = "newer_than:7d";
const GMAIL_INCREMENTAL_QUERY = "newer_than:7d";

const existingApplicationSchema = z.object({
  id: z.string().trim().min(1),
  companyName: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value ?? ""),
  positionTitle: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value ?? ""),
  companyNameNormalized: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value ?? ""),
  positionTitleNormalized: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value ?? ""),
  status: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value ?? ""),
  contactEmail: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => value ?? ""),
});

const progressSyncRequestSchema = z.object({
  gmail: z.object({
    accessToken: z.string().trim().min(1),
    googleEmail: z.string().trim().min(1),
  }),
  syncContext: z.object({
    firstSyncCompletedAt: z.string().trim().nullable().optional(),
    lastSyncCompletedAt: z.string().trim().nullable().optional(),
    lastHistoryId: z.string().trim().optional().default(""),
    applications: z.array(existingApplicationSchema).optional().default([]),
    knownMessageIds: z.array(z.string().trim().min(1)).optional().default([]),
    pendingMessageIds: z.array(z.string().trim().min(1)).optional().default([]),
  }),
});

const replyDraftRequestSchema = z.object({
  user: z.object({
    fullName: z.string().trim().optional().default(""),
    email: z.string().trim().optional().default(""),
  }),
  email: z.object({
    subject: z.string().trim().optional().default(""),
    sender: z.string().trim().optional().default(""),
    senderEmail: z.string().trim().optional().default(""),
    body: z.string().trim().optional().default(""),
    summary: z.string().trim().optional().default(""),
    companyName: z.string().trim().optional().default(""),
    positionTitle: z.string().trim().optional().default(""),
  }),
  conversationMessages: z
    .array(
      z.object({
        subject: z.string().trim().optional().default(""),
        sender: z.string().trim().optional().default(""),
        senderEmail: z.string().trim().optional().default(""),
        date: z.string().trim().optional().default(""),
        body: z.string().trim().optional().default(""),
      }),
    )
    .optional()
    .default([]),
});

const sendReplyRequestSchema = z.object({
  gmail: z.object({
    accessToken: z.string().trim().min(1),
    googleEmail: z.string().trim().min(1),
  }),
  email: z.object({
    gmailThreadId: z.string().trim().optional().default(""),
    senderEmail: z.string().trim().optional().default(""),
    recipientEmail: z.string().trim().min(1),
    subject: z.string().trim().optional().default(""),
    body: z.string().trim().optional().default(""),
    draftText: z.string().trim().min(1),
    inReplyTo: z.string().trim().optional().default(""),
    referencesHeader: z.array(z.string().trim().min(1)).optional().default([]),
  }),
});

const extractionSchema = z.object({
  summary: z.string().trim().default(""),
  intent: z
    .enum([
      "applied_confirmation",
      "follow_up",
      "invite",
      "rejection",
      "offer",
      "unknown",
    ])
    .default("unknown"),
  companyName: z.string().trim().default(""),
  positionTitle: z.string().trim().default(""),
  contactEmail: z.string().trim().default(""),
  confidence: z.number().min(0).max(1).default(0),
  needsReplyDraft: z.boolean().default(false),
  suggestedApplicationStatus: z
    .enum(["applied", "under_review", "invited", "rejected", "offer", ""])
    .default(""),
});

type ProgressSyncRequest = z.infer<typeof progressSyncRequestSchema>;
type ReplyDraftRequest = z.infer<typeof replyDraftRequestSchema>;
type SendReplyRequest = z.infer<typeof sendReplyRequestSchema>;
type Extraction = z.infer<typeof extractionSchema>;
type ExistingApplication = z.infer<typeof existingApplicationSchema>;

type CandidateMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  gmailHistoryId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  recipients: string[];
  snippet: string;
  internalDate: string;
  labelIds: string[];
};

type ConversationMessage = {
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  recipients: string[];
  snippet: string;
  rawBodyText: string;
  rawBodyHtml: string;
  receivedAt: string;
  sentAt: string;
  rfcMessageId: string;
};

type FullMessage = CandidateMessage & {
  ccRecipients: string[];
  bccRecipients: string[];
  rawHeaders: Array<{ name: string; value: string }>;
  rawBodyText: string;
  rawBodyHtml: string;
  receivedAt: string;
  sentAt: string;
  isUnread: boolean;
  rfcMessageId: string;
  inReplyTo: string;
  referencesHeader: string[];
  parentGmailMessageId: string;
  parentRfcMessageId: string;
  threadPosition: number;
  conversationMessages: ConversationMessage[];
};

type ProcessedMessage = FullMessage & {
  extraction: Extraction;
  matchedApplicationId: string;
  draftReplyText: string;
  processingStage: string;
  isRelevant: boolean;
};

const GraphState = Annotation.Root({
  request: Annotation<ProgressSyncRequest>,
  gmailQuery: Annotation<string>,
  existingApplications: Annotation<ExistingApplication[]>,
  knownMessageIds: Annotation<Set<string>>,
  pendingMessageIds: Annotation<Set<string>>,
  candidateMessages: Annotation<CandidateMessage[]>,
  relevantMessages: Annotation<CandidateMessage[]>,
  fullMessages: Annotation<FullMessage[]>,
  processedMessages: Annotation<ProcessedMessage[]>,
  scannedMessages: Annotation<number>,
  relevantMessagesCount: Annotation<number>,
});

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const formatDraftEmailText = (value: string) => {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }
  if (/<\/?[a-z][\s\S]*>/i.test(normalized)) {
    return normalized;
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeKey = (value: unknown) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const parseDate = (value: string, fallback = "") => {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const buildModel = () => {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY (or DASHSCOPE_API_KEY) is required for progress tracking",
    );
  }

  return new ChatOpenAI({
    apiKey: OPENAI_API_KEY,
    model: OPENAI_MODEL,
    temperature: 0,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
    configuration: OPENAI_BASE_URL ? { baseURL: OPENAI_BASE_URL } : undefined,
  });
};

const buildGmailClient = (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
};

const decodeBase64Url = (value: string) =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf8",
  );

const parseAddressList = (value: string) =>
  normalizeText(value)
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);

const parseEmailAddress = (value: string) => {
  const match = normalizeText(value).match(/<([^>]+)>/);
  if (match?.[1]) {
    return match[1].trim().toLowerCase();
  }
  const inlineMatch = normalizeText(value).match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );
  return inlineMatch?.[0]?.toLowerCase() || "";
};

const getHeaderValue = (
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
) =>
  headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())
    ?.value || "";

const normalizeMessageId = (value: string) => {
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

const parseReferencesHeader = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return [];
  }
  const tokenMatches = normalized.match(/<[^>]+>/g);
  if (tokenMatches?.length) {
    return tokenMatches
      .map((entry) => normalizeMessageId(entry))
      .filter(Boolean);
  }
  return normalized
    .split(/\s+/)
    .map((entry) => normalizeMessageId(entry))
    .filter(Boolean);
};

const collectBodyParts = (
  part: gmail_v1.Schema$MessagePart | undefined,
  output: { text: string[]; html: string[] },
) => {
  if (!part) {
    return;
  }

  if (part.body?.data) {
    if (part.mimeType === "text/plain") {
      output.text.push(decodeBase64Url(part.body.data));
    }
    if (part.mimeType === "text/html") {
      output.html.push(decodeBase64Url(part.body.data));
    }
  }

  for (const child of part.parts || []) {
    collectBodyParts(child, output);
  }
};

const extractMessageBodies = (
  payload: gmail_v1.Schema$MessagePart | undefined,
) => {
  const output = { text: [] as string[], html: [] as string[] };
  collectBodyParts(payload, output);
  return {
    text: output.text.join("\n").trim(),
    html: output.html.join("\n").trim(),
  };
};

const sortMessagesChronologically = <
  T extends { receivedAt: string; sentAt: string; gmailMessageId: string },
>(
  messages: T[],
) =>
  [...messages].sort((left, right) => {
    const leftTime = new Date(left.receivedAt || left.sentAt || 0).getTime();
    const rightTime = new Date(right.receivedAt || right.sentAt || 0).getTime();
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.gmailMessageId.localeCompare(right.gmailMessageId);
  });

const buildConversationMessages = (
  messages: FullMessage[],
): ConversationMessage[] =>
  sortMessagesChronologically(messages).map((message) => ({
    gmailMessageId: message.gmailMessageId,
    gmailThreadId: message.gmailThreadId,
    subject: message.subject,
    sender: message.sender,
    senderEmail: message.senderEmail,
    recipients: message.recipients,
    snippet: message.snippet,
    rawBodyText: message.rawBodyText,
    rawBodyHtml: message.rawBodyHtml,
    receivedAt: message.receivedAt,
    sentAt: message.sentAt,
    rfcMessageId: message.rfcMessageId,
  }));

const resolveThreadRelationships = (messages: FullMessage[]) => {
  const sorted = sortMessagesChronologically(messages);
  const byRfcMessageId = new Map<string, string>();

  for (let index = 0; index < sorted.length; index += 1) {
    const message = sorted[index];
    const inReplyToId = normalizeMessageId(message.inReplyTo);
    const references = Array.isArray(message.referencesHeader)
      ? message.referencesHeader
          .map((value) => normalizeMessageId(value))
          .filter(Boolean)
      : [];
    let parentGmailMessageId = "";
    let parentRfcMessageId = "";

    if (inReplyToId && byRfcMessageId.has(inReplyToId)) {
      parentGmailMessageId = byRfcMessageId.get(inReplyToId) || "";
      parentRfcMessageId = inReplyToId;
    }

    if (!parentGmailMessageId && references.length) {
      for (const referenceId of [...references].reverse()) {
        if (byRfcMessageId.has(referenceId)) {
          parentGmailMessageId = byRfcMessageId.get(referenceId) || "";
          parentRfcMessageId = referenceId;
          break;
        }
      }
    }

    if (!parentGmailMessageId && index > 0) {
      // Deterministic fallback when reply headers are missing or malformed.
      const fallbackParent = sorted[index - 1];
      if (fallbackParent.gmailMessageId !== message.gmailMessageId) {
        parentGmailMessageId = fallbackParent.gmailMessageId;
        parentRfcMessageId = fallbackParent.rfcMessageId;
      }
    }

    message.parentGmailMessageId = parentGmailMessageId;
    message.parentRfcMessageId = parentRfcMessageId;
    message.threadPosition = index + 1;

    if (message.rfcMessageId) {
      byRfcMessageId.set(message.rfcMessageId, message.gmailMessageId);
    }
  }

  return sorted;
};

const toCandidateFallback = (
  message: gmail_v1.Schema$Message,
): CandidateMessage => {
  const payload = message.payload;
  const headers = payload?.headers || [];
  return {
    gmailMessageId: message.id || "",
    gmailThreadId: message.threadId || "",
    gmailHistoryId: String(message.historyId || ""),
    subject: getHeaderValue(headers, "Subject"),
    sender: getHeaderValue(headers, "From"),
    senderEmail: parseEmailAddress(getHeaderValue(headers, "From")),
    recipients: parseAddressList(getHeaderValue(headers, "To")),
    snippet: message.snippet || "",
    internalDate: message.internalDate || "",
    labelIds: message.labelIds || [],
  };
};

// Remove tracking links and URL noise from email body text.
const stripLinksFromText = (value: unknown) => {
  if (typeof value !== "string" || !value) return value as string;

  return value
    .replace(/\r\n/g, "\n")
    .replace(/%%str_to_replace_open_tracking%%/gi, " ")
    .replace(/\[\s*https?:\/\/[^\]]+\]/gi, " ")
    .replace(/\bhttps?:\/\/[^\s<>\]]+/gi, " ")
    .replace(/\bwww\.[^\s<>\]]+/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const toFullMessage = (
  message: gmail_v1.Schema$Message,
  fallback: CandidateMessage,
): FullMessage => {
  const payload = message.payload;
  const headers = payload?.headers || [];
  const bodies = extractMessageBodies(payload);
  const sentAt = parseDate(getHeaderValue(headers, "Date"), "");
  const receivedAt = parseDate(
    message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : "",
    sentAt,
  );
  const rawHeaders = headers.map((header) => ({
    name: header.name || "",
    value: header.value || "",
  }));
  const toRecipients = parseAddressList(getHeaderValue(headers, "To"));
  const rfcMessageId = normalizeMessageId(
    getHeaderValue(headers, "Message-ID"),
  );
  const inReplyTo = normalizeMessageId(getHeaderValue(headers, "In-Reply-To"));
  const referencesHeader = parseReferencesHeader(
    getHeaderValue(headers, "References"),
  );

  return {
    ...fallback,
    gmailMessageId: message.id || fallback.gmailMessageId,
    gmailThreadId: message.threadId || fallback.gmailThreadId,
    gmailHistoryId: String(message.historyId || fallback.gmailHistoryId || ""),
    subject: getHeaderValue(headers, "Subject") || fallback.subject,
    sender: getHeaderValue(headers, "From") || fallback.sender,
    senderEmail:
      parseEmailAddress(getHeaderValue(headers, "From")) ||
      fallback.senderEmail,
    recipients: toRecipients.length ? toRecipients : fallback.recipients,
    ccRecipients: parseAddressList(getHeaderValue(headers, "Cc")),
    bccRecipients: parseAddressList(getHeaderValue(headers, "Bcc")),
    rawHeaders,
    rawBodyText: stripLinksFromText(bodies.text),
    rawBodyHtml: stripLinksFromText(bodies.html),
    receivedAt,
    sentAt,
    isUnread: (message.labelIds || []).includes("UNREAD"),
    labelIds: message.labelIds || fallback.labelIds,
    rfcMessageId,
    inReplyTo,
    referencesHeader,
    parentGmailMessageId: "",
    parentRfcMessageId: "",
    threadPosition: 0,
    conversationMessages: [],
  };
};

const isLikelyRelevant = (candidate: CandidateMessage) => {
  const haystack = [
    candidate.subject,
    candidate.snippet,
    candidate.sender,
    candidate.senderEmail,
  ]
    .join(" ")
    .toLowerCase();

  const positivePatterns = [
    "application",
    "applied",
    "interview",
    "recruit",
    "hiring",
    "talent",
    "screen",
    "schedule",
    "offer",
    "reject",
    "assessment",
    "thanks for applying",
    "thank you for applying",
  ];
  const negativePatterns = [
    "receipt",
    "invoice",
    "newsletter",
    "password",
    "verification code",
    "promotion",
    "security alert",
  ];

  const positiveScore = positivePatterns.reduce(
    (score, pattern) => score + (haystack.includes(pattern) ? 1 : 0),
    0,
  );
  const negativeScore = negativePatterns.reduce(
    (score, pattern) => score + (haystack.includes(pattern) ? 1 : 0),
    0,
  );

  return positiveScore > 0 && negativeScore === 0;
};

const extractEmailIntelligence = async (
  llm: ChatOpenAI,
  conversationMessages: ConversationMessage[],
): Promise<Extraction> => {
  const extractor = llm.withStructuredOutput(extractionSchema);
  const timeline = sortMessagesChronologically(
    conversationMessages.map((message) => ({
      ...message,
      receivedAt: message.receivedAt || "",
      sentAt: message.sentAt || "",
    })),
  )
    .map((message, index) => {
      const body =
        message.rawBodyText || message.rawBodyHtml || message.snippet;
      return [
        `Message ${index + 1}`,
        `Date: ${message.receivedAt || message.sentAt || "unknown"}`,
        `Subject: ${message.subject}`,
        `From: ${message.sender}`,
        `To: ${message.recipients.join(", ")}`,
        "Body:",
        body,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const prompt = [
    "You are extracting job-application conversation intelligence from a Gmail thread.",
    "Analyze the full conversation in chronological order and return only facts supported by the thread.",
    "Do not hallucinate company names, titles, times, or contact details.",
    'If uncertain, use empty strings or "unknown".',
    "Summary must capture the thread-level latest meaningful state for frontend display.",
    "Mark needsReplyDraft true only when the thread clearly contains an invitation or interview message that needs a human-reviewed reply.",
    "Use the whole thread as evidence for companyName, positionTitle, contactEmail, intent, and suggestedApplicationStatus.",
    "Conversation timeline:",
    timeline || "No conversation messages available.",
  ].join("\n\n");

  return extractionSchema.parse(await extractor.invoke(prompt));
};

const generateReplyDraftWithModel = async (
  llm: ChatOpenAI,
  payload: ReplyDraftRequest,
) => {
  const draftSchema = z.object({
    draftText: z.string().trim().min(1),
  });
  const drafter = llm.withStructuredOutput(draftSchema);
  const conversationTimeline = (payload.conversationMessages || [])
    .map((message, index) => {
      const body = normalizeText(message.body) || "(no body)";
      return [
        `Message ${index + 1}`,
        `Date: ${message.date || "unknown"}`,
        `Subject: ${message.subject}`,
        `From: ${message.sender}`,
        body,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const prompt = [
    "Write a concise, polite professional email reply.",
    "The reply must be ready for human review and editing.",
    "Return plain text only.",
    "Format the reply as a real email with line breaks.",
    "Do not include a subject line in the reply body.",
    "Use this structure exactly when appropriate: greeting, blank line, short body paragraphs, blank line, sign-off, sender name.",
    'Keep each section on its own line. Example structure: "Dear ...,", then body paragraphs, then "Best regards,", then the sender name.',
    "Do not invent availability or scheduling details unless they are explicitly present in the source email.",
    "Keep the tone warm and professional.",
    `User full name: ${payload.user.fullName}`,
    `User email: ${payload.user.email}`,
    `Company: ${payload.email.companyName}`,
    `Position: ${payload.email.positionTitle}`,
    `Original sender: ${payload.email.sender}`,
    `Original email subject: ${payload.email.subject}`,
    "Conversation context in chronological order:",
    conversationTimeline || "No prior conversation context provided.",
    "Original email body:",
    payload.email.body || payload.email.summary,
  ].join("\n\n");

  const result = await drafter.invoke(prompt);
  return formatDraftEmailText(result.draftText);
};

const createReplyMime = ({
  from,
  to,
  subject,
  body,
  inReplyTo,
  referencesHeader,
}: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  referencesHeader?: string[];
}) => {
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(body);
  const normalizedBody = isHtml ? body.trim() : formatDraftEmailText(body);
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject.startsWith("Re:") ? subject : `Re: ${subject}`}`,
    isHtml ? "Content-Type: text/html; charset=utf-8" : "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];
  if (normalizeText(inReplyTo)) {
    headers.push(`In-Reply-To: <${normalizeMessageId(inReplyTo || "")}>`);
  }
  if (Array.isArray(referencesHeader) && referencesHeader.length) {
    const normalizedReferences = referencesHeader
      .map((entry) => normalizeMessageId(entry))
      .filter(Boolean)
      .map((entry) => `<${entry}>`)
      .join(" ");
    if (normalizedReferences) {
      headers.push(`References: ${normalizedReferences}`);
    }
  }

  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${normalizedBody}`)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const loadSyncContext = async (state: typeof GraphState.State) => {
  const isFirstSync = !normalizeText(
    state.request.syncContext.firstSyncCompletedAt,
  );
  return {
    gmailQuery: isFirstSync ? GMAIL_FIRST_SYNC_QUERY : GMAIL_INCREMENTAL_QUERY,
    existingApplications: state.request.syncContext.applications || [],
    knownMessageIds: new Set(state.request.syncContext.knownMessageIds || []),
    pendingMessageIds: new Set(
      state.request.syncContext.pendingMessageIds || [],
    ),
  };
};

const listCandidateMessages = async (state: typeof GraphState.State) => {
  const gmail = buildGmailClient(state.request.gmail.accessToken);
  const response = await gmail.users.messages.list({
    userId: "me",
    q: state.gmailQuery,
    maxResults: GMAIL_MAX_CANDIDATES,
  });

  const entries = response.data.messages || [];
  const candidateMessages: CandidateMessage[] = [];

  for (const entry of entries) {
    if (!entry.id || state.knownMessageIds.has(entry.id)) {
      continue;
    }

    const metadata = await gmail.users.messages.get({
      userId: "me",
      id: entry.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To", "Date"],
    });
    const payload = metadata.data.payload;
    const headers = payload?.headers || [];
    candidateMessages.push({
      gmailMessageId: metadata.data.id || entry.id,
      gmailThreadId: metadata.data.threadId || "",
      gmailHistoryId: String(metadata.data.historyId || ""),
      subject: getHeaderValue(headers, "Subject"),
      sender: getHeaderValue(headers, "From"),
      senderEmail: parseEmailAddress(getHeaderValue(headers, "From")),
      recipients: parseAddressList(getHeaderValue(headers, "To")),
      snippet: metadata.data.snippet || "",
      internalDate: metadata.data.internalDate || "",
      labelIds: metadata.data.labelIds || [],
    });
  }

  return {
    candidateMessages,
    scannedMessages: candidateMessages.length,
  };
};

const filterRelevantMessages = async (state: typeof GraphState.State) => {
  const relevantMessages = state.candidateMessages.filter(isLikelyRelevant);
  return {
    relevantMessages,
    relevantMessagesCount: relevantMessages.length,
  };
};

const fetchFullMessages = async (state: typeof GraphState.State) => {
  const gmail = buildGmailClient(state.request.gmail.accessToken);
  const fullMessages: FullMessage[] = [];
  const seenMessageIds = new Set<string>();
  const visitedThreadIds = new Set<string>();

  const pushThreadMessages = (threadMessages: gmail_v1.Schema$Message[]) => {
    const parsedMessages = threadMessages
      .map((threadMessage) =>
        toFullMessage(threadMessage, toCandidateFallback(threadMessage)),
      )
      .filter((message) => Boolean(message.gmailMessageId));

    if (!parsedMessages.length) {
      return;
    }

    const resolvedMessages = resolveThreadRelationships(parsedMessages);
    const conversationMessages = buildConversationMessages(resolvedMessages);

    for (const message of resolvedMessages) {
      if (seenMessageIds.has(message.gmailMessageId)) {
        continue;
      }
      const isKnown = state.knownMessageIds.has(message.gmailMessageId);
      const isPending = state.pendingMessageIds.has(message.gmailMessageId);
      if (isKnown && !isPending) {
        continue;
      }
      message.conversationMessages = conversationMessages;
      fullMessages.push(message);
      seenMessageIds.add(message.gmailMessageId);
    }
  };

  for (const candidate of state.relevantMessages) {
    if (
      candidate.gmailThreadId &&
      !visitedThreadIds.has(candidate.gmailThreadId)
    ) {
      visitedThreadIds.add(candidate.gmailThreadId);
      try {
        const threadResponse = await gmail.users.threads.get({
          userId: "me",
          id: candidate.gmailThreadId,
          format: "full",
        });
        if (
          Array.isArray(threadResponse.data.messages) &&
          threadResponse.data.messages.length
        ) {
          pushThreadMessages(threadResponse.data.messages);
          continue;
        }
      } catch {
        // Fallback to single-message fetch when thread retrieval fails.
      }
    }

    if (seenMessageIds.has(candidate.gmailMessageId)) {
      continue;
    }

    const full = await gmail.users.messages.get({
      userId: "me",
      id: candidate.gmailMessageId,
      format: "full",
    });
    const parsedSingle = toFullMessage(full.data, candidate);
    const resolvedSingle = resolveThreadRelationships([parsedSingle]);
    const conversationMessages = buildConversationMessages(resolvedSingle);
    const enrichedMessage = resolvedSingle[0];
    const isKnown = state.knownMessageIds.has(enrichedMessage.gmailMessageId);
    const isPending = state.pendingMessageIds.has(
      enrichedMessage.gmailMessageId,
    );
    if (isKnown && !isPending) {
      continue;
    }
    enrichedMessage.conversationMessages = conversationMessages;
    fullMessages.push(enrichedMessage);
    seenMessageIds.add(enrichedMessage.gmailMessageId);
  }

  return { fullMessages };
};

const extractAndPrepareMessages = async (state: typeof GraphState.State) => {
  const llm = buildModel();
  const processedMessages: ProcessedMessage[] = [];
  const groupedByThread = new Map<string, FullMessage[]>();

  for (const message of state.fullMessages) {
    const groupKey =
      normalizeText(message.gmailThreadId) || message.gmailMessageId;
    const group = groupedByThread.get(groupKey) || [];
    group.push(message);
    groupedByThread.set(groupKey, group);
  }

  for (const threadMessages of groupedByThread.values()) {
    const sortedThreadMessages = sortMessagesChronologically(threadMessages);
    const conversationMessages = sortedThreadMessages[0]?.conversationMessages
      ?.length
      ? sortedThreadMessages[0].conversationMessages
      : buildConversationMessages(sortedThreadMessages);

    const extraction = await extractEmailIntelligence(
      llm,
      conversationMessages,
    );
    const matchedApplication = state.existingApplications.find(
      (application) => {
        const companyKey = normalizeKey(
          application.companyNameNormalized || application.companyName,
        );
        const positionKey = normalizeKey(
          application.positionTitleNormalized || application.positionTitle,
        );
        return (
          companyKey &&
          positionKey &&
          companyKey === normalizeKey(extraction.companyName) &&
          positionKey === normalizeKey(extraction.positionTitle)
        );
      },
    );

    const rootMessages = sortedThreadMessages.filter(
      (message) => !message.parentGmailMessageId,
    );
    const draftTargetRoot = rootMessages[0] || sortedThreadMessages[0];
    let draftReplyText = "";

    if (extraction.intent === "invite" && extraction.needsReplyDraft) {
      draftReplyText = await generateReplyDraftWithModel(llm, {
        user: {
          fullName: "",
          email: "",
        },
        email: {
          subject: draftTargetRoot.subject,
          sender: draftTargetRoot.sender,
          senderEmail: draftTargetRoot.senderEmail,
          body:
            draftTargetRoot.rawBodyText ||
            draftTargetRoot.rawBodyHtml ||
            draftTargetRoot.snippet,
          summary: extraction.summary,
          companyName: extraction.companyName,
          positionTitle: extraction.positionTitle,
        },
        conversationMessages: conversationMessages.map((message) => ({
          subject: message.subject,
          sender: message.sender,
          senderEmail: message.senderEmail,
          date: message.receivedAt || message.sentAt,
          body: message.rawBodyText || message.rawBodyHtml || message.snippet,
        })),
      });
    }

    for (const message of sortedThreadMessages) {
      processedMessages.push({
        ...message,
        extraction,
        matchedApplicationId: matchedApplication?.id || "",
        draftReplyText:
          message.gmailMessageId === draftTargetRoot.gmailMessageId
            ? draftReplyText
            : "",
        processingStage: "persisted",
        isRelevant: true,
      });
    }
  }

  return { processedMessages };
};

const buildProgressGraph = () =>
  new StateGraph(GraphState)
    .addNode("loadSyncContext", loadSyncContext)
    .addNode("listCandidateMessages", listCandidateMessages)
    .addNode("filterRelevantMessages", filterRelevantMessages)
    .addNode("fetchFullMessages", fetchFullMessages)
    .addNode("extractAndPrepareMessages", extractAndPrepareMessages)
    .addEdge(START, "loadSyncContext")
    .addEdge("loadSyncContext", "listCandidateMessages")
    .addEdge("listCandidateMessages", "filterRelevantMessages")
    .addEdge("filterRelevantMessages", "fetchFullMessages")
    .addEdge("fetchFullMessages", "extractAndPrepareMessages")
    .addEdge("extractAndPrepareMessages", END)
    .compile();

export const syncProgressTrackingMailbox = async (input: unknown) => {
  const request = progressSyncRequestSchema.parse(input);
  const graph = buildProgressGraph();
  const result = await graph.invoke({
    request,
    gmailQuery: "",
    existingApplications: [],
    knownMessageIds: new Set<string>(),
    pendingMessageIds: new Set<string>(),
    candidateMessages: [],
    relevantMessages: [],
    fullMessages: [],
    processedMessages: [],
    scannedMessages: 0,
    relevantMessagesCount: 0,
  });

  return {
    scannedMessages: result.scannedMessages || 0,
    relevantMessages: result.relevantMessagesCount || 0,
    lastHistoryId:
      result.processedMessages[result.processedMessages.length - 1]
        ?.gmailHistoryId || "",
    messages: result.processedMessages.map((message) => ({
      gmailMessageId: message.gmailMessageId,
      gmailThreadId: message.gmailThreadId,
      gmailHistoryId: message.gmailHistoryId,
      rfcMessageId: message.rfcMessageId,
      inReplyTo: message.inReplyTo,
      referencesHeader: message.referencesHeader,
      parentGmailMessageId: message.parentGmailMessageId,
      parentRfcMessageId: message.parentRfcMessageId,
      threadPosition: message.threadPosition,
      subject: message.subject,
      sender: message.sender,
      senderEmail: message.senderEmail,
      recipients: message.recipients,
      ccRecipients: message.ccRecipients,
      bccRecipients: message.bccRecipients,
      snippet: message.snippet,
      labelIds: message.labelIds,
      rawHeaders: message.rawHeaders,
      rawBodyText: message.rawBodyText,
      rawBodyHtml: message.rawBodyHtml,
      receivedAt: message.receivedAt,
      sentAt: message.sentAt,
      isUnread: message.isUnread,
      isRelevant: message.isRelevant,
      matchedApplicationId: message.matchedApplicationId,
      processingStage: message.processingStage,
      draftReplyText: message.draftReplyText,
      extraction: message.extraction,
    })),
  };
};

export const generateInviteReplyDraft = async (input: unknown) => {
  const payload = replyDraftRequestSchema.parse(input);
  const llm = buildModel();
  const draftText = await generateReplyDraftWithModel(llm, payload);
  return { draftText };
};

export const sendInviteReply = async (input: unknown) => {
  const payload = sendReplyRequestSchema.parse(input);
  const gmail = buildGmailClient(payload.gmail.accessToken);
  const raw = createReplyMime({
    from: payload.email.senderEmail || payload.gmail.googleEmail,
    to: payload.email.recipientEmail,
    subject: payload.email.subject,
    body: payload.email.draftText,
    inReplyTo: payload.email.inReplyTo,
    referencesHeader: payload.email.referencesHeader,
  });

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: payload.email.gmailThreadId || undefined,
    },
  });

  return {
    sentMessageId: response.data.id || "",
    threadId: response.data.threadId || payload.email.gmailThreadId || "",
  };
};
