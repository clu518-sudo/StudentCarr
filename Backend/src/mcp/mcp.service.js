import {
  listApplicationsForUser,
  listEmailsForApplication,
  getEmailDetailById,
} from "../processTracking/pt.service.js";
import { getProfileForUser } from "../profileManagement/pm.service.js";

// Manual-entry rich-text fields are stored as tiptap HTML. Models read plain
// text more reliably and pay fewer tokens for it, so flatten before returning.
const MAX_TEXT_CHARS = 1500;

const stripHtml = (value) => {
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

    return text.length > MAX_TEXT_CHARS
        ? `${text.slice(0, MAX_TEXT_CHARS)}...`
        : text;
};

//                            ── Handlers ──
// One function per message tag. Each takes userId and returns the payload
// that the controller wraps in `{ success: true, data }`.
// When a handler gets large, move it to ./handlers/<tag>.js and re-import.

const NO_RECORDS_MESSAGE =
    "No records yet. Open the Progress Tracking page in StudentCarr and press Sync to import job-application emails from Gmail.";

// Read-only. This deliberately does NOT run the Gmail/AI sync workflow: the
// assistant reports what Progress Tracking has already stored, and only the
// Sync button on the Progress Tracking page writes new data.
const getEmailsHandler = async (userId) => {

    // 1) Get applications already stored for this user
    const { applications = [] } = await listApplicationsForUser(userId);

    // 2) Collect all email IDs from each application
    const emailIdNested = await Promise.all(
        applications.map( async (app) => {
            const { emails = [] } = await listEmailsForApplication(userId, app.id);
            return emails.map((email)=> email.id);
        } ),
    );

    const emailIds = emailIdNested.flat();

    // 3) Fetch full details (body + replies/thread)
    const emailDetails = await Promise.all(
        emailIds.map(async (emailId) => {
            const detail = await getEmailDetailById(userId, emailId);
            return detail.email
        }),
    );

    // Nothing stored yet — tell the model to say so rather than let it assume
    // the mailbox is empty or that it should try to sync.
    if (!emailDetails.length) {
        return {
            hasRecords: false,
            emails: [],
            message: NO_RECORDS_MESSAGE,
        };
    }

    return {
        hasRecords: true,
        emails: emailDetails,
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


//                     ── Dispatcher ──
// To add a new tag: write a handler above, then add it here.
const MESSAGE_HANDLER = {
    getEmails: getEmailsHandler,
    // futureTag: furtureFunctionHandler
};

const runService = async (userId, message) => {
    const handler = MESSAGE_HANDLER[message];
    if (!handler) {
        const error = new Error(`Unsupported MCP message: ${String(message)}`);
        error.statusCode = 400;
        throw error;
    }
    return handler(userId);
};

export { runService, getManualProfile };
