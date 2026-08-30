import {
    getEmailDetailById,
    listApplicationSummariesForUser,
    listEmailSummariesForUser,
} from "../processTracking/pt.service.js";
import { getProfileForUser } from "../profileManagement/pm.service.js";

// Manual-entry rich-text fields are stored as tiptap HTML. Models read plain
// text more reliably and pay fewer tokens for it, so flatten before returning.
const MAX_TEXT_CHARS = 1500;

// Sized from the ~6k-token per-response budget agreed for Phase 6. Only
// getEmailDetail returns a body at all, and only for one email at a time.
const MAX_EMAIL_BODY_CHARS = 6000;

const truncate = (text, maxChars) =>
    text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;

const stripHtml = (value, maxChars = MAX_TEXT_CHARS) => {
    if (typeof value !== "string" || !value) {
        return "";
    }

    const text = value
        .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/blockquote)\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return truncate(text, maxChars);
};

// A quoted reply chain repeats the entire prior thread inside every message.
// That is pure duplication for a model that can fetch the thread itself, and on
// a long exchange it is most of the payload.
const QUOTED_HTML_PATTERN =
    /<(?:blockquote|div)[^>]*(?:gmail_quote|yahoo_quoted|moz-cite-prefix)[^>]*>[\s\S]*$/i;

const QUOTED_TEXT_PATTERNS = [
    /^\s*-{2,}\s*Original Message\s*-{2,}/im,
    /^\s*_{5,}\s*$/m,
    /^\s*On .{0,120}\bwrote:\s*$/im,
    /^\s*>/m,
];

const cutAtFirstQuote = (text) => {
    let cutAt = text.length;
    for (const pattern of QUOTED_TEXT_PATTERNS) {
        const match = pattern.exec(text);
        if (match && match.index < cutAt) {
            cutAt = match.index;
        }
    }
    return text.slice(0, cutAt).trim();
};

// HTML quote containers must go before tags are stripped, plain-text markers
// after — otherwise the container's text survives as unquotable prose.
const cleanEmailBody = (value) => {
    if (typeof value !== "string" || !value) {
        return "";
    }

    const plain = stripHtml(
        value.replace(QUOTED_HTML_PATTERN, ""),
        Number.MAX_SAFE_INTEGER,
    );

    return truncate(cutAtFirstQuote(plain), MAX_EMAIL_BODY_CHARS);
};

//                            ── Tool handlers ──
// One function per MCP tool, each behind its own route. Each takes userId from
// the verified scoped token and returns the payload the controller wraps in
// `{ success: true, data }`.

const NO_RECORDS_MESSAGE =
    "No records yet. Open the Progress Tracking page in StudentCarr and press Sync to import job-application emails from Gmail.";

// All three reads below are read-only by design. They deliberately do NOT run
// the Gmail/AI sync workflow: the assistant reports what Progress Tracking has
// already stored, and only the Sync button on that page writes new data.

const listApplications = async (userId) => {
    const { applications } = await listApplicationSummariesForUser(userId);

    // Nothing stored yet — tell the model to say so rather than let it assume
    // the mailbox is empty or that it should try to sync.
    if (!applications.length) {
        return {
            hasRecords: false,
            applications: [],
            message: NO_RECORDS_MESSAGE,
        };
    }

    return {
        hasRecords: true,
        applications,
    };
};

const listApplicationEmails = async (userId, filters = {}) => {
    const { emails, nextCursor } = await listEmailSummariesForUser(
        userId,
        filters,
    );

    if (!emails.length) {
        return {
            hasRecords: false,
            emails: [],
            nextCursor: null,
            message: NO_RECORDS_MESSAGE,
        };
    }

    return {
        hasRecords: true,
        emails,
        nextCursor,
    };
};

// The only path that returns a message body, one email at a time.
const getEmailDetail = async (userId, emailId) => {
    const { email } = await getEmailDetailById(userId, emailId);

    return {
        email: {
            ...email,
            body: cleanEmailBody(email.body),
            replies: (email.replies || []).map((reply) => ({
                ...reply,
                body: cleanEmailBody(reply.body),
            })),
        },
    };
};

// Manual Entry profile, shaped for a model rather than for the profile form.
const getManualProfile = async (userId) => {
    const { manualProfile } = await getProfileForUser(userId);

    return {
        profile: {
            ...manualProfile,
            personalInfo: {
                ...manualProfile.personalInfo,
                summary: stripHtml(manualProfile.personalInfo?.summary),
            },
            education: manualProfile.education.map((item) => ({
                ...item,
                description: stripHtml(item.description),
            })),
            workExperience: manualProfile.workExperience.map((item) => ({
                ...item,
                description: stripHtml(item.description),
            })),
            projects: manualProfile.projects.map((item) => ({
                ...item,
                description: stripHtml(item.description),
            })),
        },
    };
};

export {
    getEmailDetail,
    getManualProfile,
    listApplicationEmails,
    listApplications,
};
