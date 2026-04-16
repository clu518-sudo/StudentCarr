/**
 * @typedef {"applied_confirmation" | "follow_up" | "invite" | "rejection" | "unknown"} EmailIntent
 * @typedef {"applied" | "under_review" | "invited" | "rejected" | "offer"} ApplicationStatus
 *
 * @typedef {Object} JobApplication
 * @property {string} id
 * @property {string} companyName
 * @property {string} positionTitle
 * @property {ApplicationStatus} status
 * @property {string} lastUpdatedAt
 *
 * @typedef {Object} ApplicationEmail
 * @property {string} id
 * @property {string} applicationId
 * @property {string} sender
 * @property {string} subject
 * @property {string} date
 * @property {EmailIntent} intent
 *
 * @typedef {Object} ReplyDraft
 * @property {string} emailId
 * @property {string} draftText
 * @property {"mock-ai"} source
 * @property {boolean} editable
 */

const applicationSeeds = [
  {
    id: "app-aurora-frontend",
    companyName: "Aurora Labs",
    positionTitle: "Frontend Engineer",
  },
  {
    id: "app-northstar-data",
    companyName: "Northstar Data",
    positionTitle: "Data Analyst",
  },
  {
    id: "app-harbor-cloud",
    companyName: "Harbor Cloud",
    positionTitle: "Cloud Support Engineer",
    statusHint: "offer",
  },
];

const emailSeeds = [
  {
    id: "email-aurora-1",
    applicationId: "app-aurora-frontend",
    sender: "careers@auroralabs.dev",
    subject: "Application received - Frontend Engineer",
    date: "2026-04-08T09:10:00.000Z",
    intent: "applied_confirmation",
    body:
      "Hi there,\n\nThank you for applying to Aurora Labs. We have received your application for the Frontend Engineer role.\n\nBest,\nAurora Labs Recruiting",
  },
  {
    id: "email-aurora-2",
    applicationId: "app-aurora-frontend",
    sender: "recruiter@auroralabs.dev",
    subject: "Interview invitation for Frontend Engineer",
    date: "2026-04-11T14:45:00.000Z",
    intent: "invite",
    body:
      "Hello,\n\nWe reviewed your profile and would like to invite you to a 45-minute interview this week. Please reply with your preferred time slots.\n\nRegards,\nAurora Labs Recruiting",
  },
  {
    id: "email-northstar-1",
    applicationId: "app-northstar-data",
    sender: "jobs@northstar.ai",
    subject: "Thanks for your application",
    date: "2026-04-03T10:00:00.000Z",
    intent: "applied_confirmation",
    body:
      "Hello,\n\nWe received your application for the Data Analyst role.\n\nNorthstar Data Team",
  },
  {
    id: "email-northstar-2",
    applicationId: "app-northstar-data",
    sender: "recruiting@northstar.ai",
    subject: "Application update",
    date: "2026-04-10T16:20:00.000Z",
    intent: "rejection",
    body:
      "Hi,\n\nThank you for your interest. We decided to move forward with other candidates at this time.\n\nSincerely,\nNorthstar Data",
  },
  {
    id: "email-harbor-1",
    applicationId: "app-harbor-cloud",
    sender: "talent@harborcloud.io",
    subject: "Application confirmation",
    date: "2026-04-05T08:30:00.000Z",
    intent: "applied_confirmation",
    body:
      "Hi,\n\nThis email confirms we received your application.\n\nHarbor Cloud",
  },
  {
    id: "email-harbor-2",
    applicationId: "app-harbor-cloud",
    sender: "talent@harborcloud.io",
    subject: "Final decision and compensation package",
    date: "2026-04-14T11:15:00.000Z",
    intent: "unknown",
    body:
      "Hello,\n\nWe are excited to move forward and share your compensation package details. Please reply to confirm your interest.\n\nHarbor Cloud Hiring",
  },
];

const sentReplyStore = new Map();

const toSentReplyStoreKey = (userId, emailId) => `${userId}:${emailId}`;

const compareByDateDesc = (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime();

const mapIntentToStatus = {
  invite: "invited",
  rejection: "rejected",
  follow_up: "under_review",
  applied_confirmation: "applied",
};

const deriveStatusFromEmails = (application, applicationEmails) => {
  if (application.statusHint === "offer") {
    return "offer";
  }

  const sorted = [...applicationEmails].sort(compareByDateDesc);
  for (const email of sorted) {
    const status = mapIntentToStatus[email.intent];
    if (status) {
      return status;
    }
  }

  return "under_review";
};

const listApplicationsForUser = async () => {
  const applications = applicationSeeds
    .map((application) => {
      const relatedEmails = emailSeeds
        .filter((email) => email.applicationId === application.id)
        .sort(compareByDateDesc);
      const lastUpdatedAt = relatedEmails[0]?.date || new Date().toISOString();
      const status = deriveStatusFromEmails(application, relatedEmails);

      return {
        id: application.id,
        companyName: application.companyName,
        positionTitle: application.positionTitle,
        status,
        lastUpdatedAt,
      };
    })
    .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());

  return { applications };
};

const listEmailsForApplication = async (applicationId) => {
  const application = applicationSeeds.find((item) => item.id === applicationId);
  if (!application) {
    const error = new Error("Application not found");
    error.statusCode = 404;
    throw error;
  }

  const emails = emailSeeds
    .filter((email) => email.applicationId === applicationId)
    .map((email) => ({
      id: email.id,
      applicationId: email.applicationId,
      sender: email.sender,
      subject: email.subject,
      date: email.date,
      intent: email.intent,
    }))
    .sort(compareByDateDesc);

  return { emails };
};

const getEmailDetailById = async (emailId) => {
  const email = emailSeeds.find((item) => item.id === emailId);
  if (!email) {
    const error = new Error("Email not found");
    error.statusCode = 404;
    throw error;
  }

  return {
    email: {
      id: email.id,
      applicationId: email.applicationId,
      sender: email.sender,
      subject: email.subject,
      date: email.date,
      intent: email.intent,
      body: email.body,
    },
  };
};

// Future extension point: replace with AIServices-powered draft generation.
const replyDraftGenerator = async (email) => {
  const firstName = email.sender.split("@")[0] || "Hiring Team";
  return {
    emailId: email.id,
    draftText: `Hi ${firstName},\n\nThank you for the invitation. I am excited to continue with the ${email.subject.replace("Interview invitation for ", "")} process.\n\nI am available this week on Tuesday afternoon or Thursday morning. Please let me know which time works best.\n\nBest regards,`,
    source: "mock-ai",
    editable: true,
  };
};

const getInviteReplyDraftByEmailId = async (emailId) => {
  const email = emailSeeds.find((item) => item.id === emailId);
  if (!email) {
    const error = new Error("Email not found");
    error.statusCode = 404;
    throw error;
  }

  if (email.intent !== "invite") {
    const error = new Error("Reply draft is only available for invite emails");
    error.statusCode = 400;
    throw error;
  }

  const draft = await replyDraftGenerator(email);
  return { draft };
};

const confirmInviteReplySend = async (userId, emailId, draftText) => {
  const email = emailSeeds.find((item) => item.id === emailId);
  if (!email) {
    const error = new Error("Email not found");
    error.statusCode = 404;
    throw error;
  }

  if (email.intent !== "invite") {
    const error = new Error("Only invite emails can be confirmed for reply");
    error.statusCode = 400;
    throw error;
  }

  const storeKey = toSentReplyStoreKey(userId, emailId);
  const confirmation = {
    emailId,
    status: "sent",
    deliveryId: `mock-send-${emailId}`,
    confirmedAt: new Date().toISOString(),
    confirmedDraftText: draftText,
  };
  sentReplyStore.set(storeKey, confirmation);

  return { confirmation };
};

export {
  listApplicationsForUser,
  listEmailsForApplication,
  getEmailDetailById,
  getInviteReplyDraftByEmailId,
  confirmInviteReplySend,
};
