import {
  syncProgressTrackingForUser,
  listApplicationsForUser,
  listEmailsForApplication,
  getEmailDetailById,
} from "../processTracking/pt.service.js";

//                            ── Handlers ──
// One function per message tag. Each takes userId and returns the payload
// that the controller wraps in `{ success: true, data }`.
// When a handler gets large, move it to ./handlers/<tag>.js and re-import.

const getEmailsHandler = async (userId) => {

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

    return {
        sync: syncResult.sync,
        emails: emailDetails,
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

export { runService };
