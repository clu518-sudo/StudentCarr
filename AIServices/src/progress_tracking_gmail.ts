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
const GMAIL_MAX_CANDIDATES = Number(process.env.GMAIL_SYNC_MAX_CANDIDATES || 30);
const GMAIL_FIRST_SYNC_QUERY = "newer_than:7d";
const GMAIL_INCREMENTAL_QUERY = "is:unread newer_than:30d";

const existingApplicationSchema = z.object({
  id: z.string().trim().min(1),
  companyName: z.string().trim().optional().default(""),
  positionTitle: z.string().trim().optional().default(""),
  companyNameNormalized: z.string().trim().optional().default(""),
  positionTitleNormalized: z.string().trim().optional().default(""),
  status: z.string().trim().optional().default(""),
  contactEmail: z.string().trim().optional().default(""),
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

type FullMessage = CandidateMessage & {
  ccRecipients: string[];
  bccRecipients: string[];
  rawHeaders: Array<{ name: string; value: string }>;
  rawBodyText: string;
  rawBodyHtml: string;
  receivedAt: string;
  sentAt: string;
  isUnread: boolean;
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
  candidateMessages: Annotation<CandidateMessage[]>,
  relevantMessages: Annotation<CandidateMessage[]>,
  fullMessages: Annotation<FullMessage[]>,
  processedMessages: Annotation<ProcessedMessage[]>,
  scannedMessages: Annotation<number>,
  relevantMessagesCount: Annotation<number>,
});

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

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
    throw new Error("OPENAI_API_KEY (or DASHSCOPE_API_KEY) is required for progress tracking");
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
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

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
  const inlineMatch = normalizeText(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return inlineMatch?.[0]?.toLowerCase() || "";
};

const getHeaderValue = (
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
) =>
  headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || "";

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

const extractMessageBodies = (payload: gmail_v1.Schema$MessagePart | undefined) => {
  const output = { text: [] as string[], html: [] as string[] };
  collectBodyParts(payload, output);
  return {
    text: output.text.join("\n").trim(),
    html: output.html.join("\n").trim(),
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
  message: FullMessage,
): Promise<Extraction> => {
  const extractor = llm.withStructuredOutput(extractionSchema);
  const prompt = [
    "You are extracting job-application email intelligence.",
    "Return only facts supported by the email.",
    "Do not hallucinate company names, titles, times, or contact details.",
    'If uncertain, use empty strings or "unknown".',
    "Summaries must be concise and useful for a frontend email list.",
    "Mark needsReplyDraft true only when the email is clearly an interview or invitation that requires a human-reviewed response.",
    "Email metadata:",
    `Subject: ${message.subject}`,
    `From: ${message.sender}`,
    `To: ${message.recipients.join(", ")}`,
    `Snippet: ${message.snippet}`,
    "Email body:",
    message.rawBodyText || message.rawBodyHtml || message.snippet,
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
  const prompt = [
    "Write a concise, polite professional email reply.",
    "The reply must be ready for human review and editing.",
    "Do not invent availability or scheduling details unless they are explicitly present in the source email.",
    "Keep the tone warm and professional.",
    `User full name: ${payload.user.fullName}`,
    `User email: ${payload.user.email}`,
    `Company: ${payload.email.companyName}`,
    `Position: ${payload.email.positionTitle}`,
    `Original sender: ${payload.email.sender}`,
    `Original email subject: ${payload.email.subject}`,
    "Original email body:",
    payload.email.body || payload.email.summary,
  ].join("\n\n");

  const result = await drafter.invoke(prompt);
  return result.draftText;
};

const createReplyMime = ({
  from,
  to,
  subject,
  body,
}: {
  from: string;
  to: string;
  subject: string;
  body: string;
}) => {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject.startsWith("Re:") ? subject : `Re: ${subject}`}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];

  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const loadSyncContext = async (state: typeof GraphState.State) => {
  const isFirstSync = !normalizeText(state.request.syncContext.firstSyncCompletedAt);
  return {
    gmailQuery: isFirstSync ? GMAIL_FIRST_SYNC_QUERY : GMAIL_INCREMENTAL_QUERY,
    existingApplications: state.request.syncContext.applications || [],
    knownMessageIds: new Set(state.request.syncContext.knownMessageIds || []),
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

  for (const candidate of state.relevantMessages) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: candidate.gmailMessageId,
      format: "full",
    });
    const payload = full.data.payload;
    const headers = payload?.headers || [];
    const bodies = extractMessageBodies(payload);
    const sentAt = parseDate(getHeaderValue(headers, "Date"), "");
    const receivedAt = parseDate(
      full.data.internalDate ? new Date(Number(full.data.internalDate)).toISOString() : "",
      sentAt,
    );

    fullMessages.push({
      ...candidate,
      sender: getHeaderValue(headers, "From") || candidate.sender,
      senderEmail: parseEmailAddress(getHeaderValue(headers, "From")) || candidate.senderEmail,
      recipients: parseAddressList(getHeaderValue(headers, "To")) || candidate.recipients,
      ccRecipients: parseAddressList(getHeaderValue(headers, "Cc")),
      bccRecipients: parseAddressList(getHeaderValue(headers, "Bcc")),
      rawHeaders: headers.map((header) => ({
        name: header.name || "",
        value: header.value || "",
      })),
      rawBodyText: bodies.text,
      rawBodyHtml: bodies.html,
      receivedAt,
      sentAt,
      isUnread: (full.data.labelIds || []).includes("UNREAD"),
      labelIds: full.data.labelIds || candidate.labelIds,
    });
  }

  return { fullMessages };
};

const extractAndPrepareMessages = async (state: typeof GraphState.State) => {
  const llm = buildModel();
  const processedMessages: ProcessedMessage[] = [];

  for (const message of state.fullMessages) {
    const extraction = await extractEmailIntelligence(llm, message);
    const matchedApplication = state.existingApplications.find((application) => {
      const companyKey =
        normalizeKey(application.companyNameNormalized || application.companyName);
      const positionKey =
        normalizeKey(application.positionTitleNormalized || application.positionTitle);
      return (
        companyKey &&
        positionKey &&
        companyKey === normalizeKey(extraction.companyName) &&
        positionKey === normalizeKey(extraction.positionTitle)
      );
    });

    let draftReplyText = "";
    if (extraction.intent === "invite" && extraction.needsReplyDraft) {
      draftReplyText = await generateReplyDraftWithModel(llm, {
        user: {
          fullName: "",
          email: "",
        },
        email: {
          subject: message.subject,
          sender: message.sender,
          senderEmail: message.senderEmail,
          body: message.rawBodyText || message.rawBodyHtml || message.snippet,
          summary: extraction.summary,
          companyName: extraction.companyName,
          positionTitle: extraction.positionTitle,
        },
      });
    }

    processedMessages.push({
      ...message,
      extraction,
      matchedApplicationId: matchedApplication?.id || "",
      draftReplyText,
      processingStage: "persisted",
      isRelevant: true,
    });
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
      result.processedMessages[result.processedMessages.length - 1]?.gmailHistoryId || "",
    messages: result.processedMessages.map((message) => ({
      gmailMessageId: message.gmailMessageId,
      gmailThreadId: message.gmailThreadId,
      gmailHistoryId: message.gmailHistoryId,
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
