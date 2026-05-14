import {
  syncProgressTrackingForUser,
  listApplicationsForUser,
  listEmailsForApplication,
  getEmailDetailById,
} from "../processTracking/pt.service.js";

// Remove tracking links and URL noise from email body text.
const stripLinksFromText = (value) => {
  if (typeof value !== "string" || !value) return value;

  return value
    .replace(/\r\n/g, "\n")
    // remove placeholder token
    .replace(/%%str_to_replace_open_tracking%%/gi, " ")
    // remove bracketed URLs like [https://email.s.seek.co.nz/...]
    .replace(/\[\s*https?:\/\/[^\]]+\]/gi, " ")
    // remove plain URLs (including SEEK tracking links pasted after bracketed links)
    .replace(/\bhttps?:\/\/[^\s<>\]]+/gi, " ")
    .replace(/\bwww\.[^\s<>\]]+/gi, " ")
    // cleanup spaces and blank lines while preserving paragraph breaks
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const runProgressTracking = async (userId, message) => {
    /*
        message: used as tag, indecating which function to run. 
                recent value(s): getEmails ......
     */

    // get job hunting related emails
    if (message === "getEmails") {

        // 1) Sync latest data from Gmail/AI pipeline
        const syncResult = await syncProgressTrackingForUser(userId);
        
        // 2) Get applications
        const { applications = [] } = await listApplicationsForUser(userId);

        // 3) Collect all email IDs from each application
        const emailIdNested = await Promise.all(
            applications.map( async (app) => {
                const { emails = [] } = await listEmailsForApplication(userId, app.id);
                return emails.map((email)=> email.id);
            } ),
        );

        const emailIds = emailIdNested.flat();

        // 4) Fetch full details (body + replies/thread)
        const emailDetails = await Promise.all(
            emailIds.map(async (emailId) => {
                const detail = await getEmailDetailById(userId, emailId);
                return detail.email
            }),
        );

        const sanitizeEmailDetail = (emailDetail) => ({
            ...emailDetail,
            body: stripLinksFromText(emailDetail.body),
            replies: Array.isArray(emailDetail.replies) ? emailDetail.replies.map((reply) => ({
                ...reply,
                body: stripLinksFromText(reply.body)
            })) : [],
        });

        const cleanedEmailDetails = emailDetails.map(sanitizeEmailDetail);

        return {
          sync: syncResult.sync,
          emails: cleanedEmailDetails,
        };
    };

    // Todo
    // if there more functions in the furture

    const error = new Error(`Unsupported MCP message: ${String(message)}`);
    error.statusCode = 400;
    throw error;
};

export { runProgressTracking };
