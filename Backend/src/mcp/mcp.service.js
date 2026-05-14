import {
  syncProgressTrackingForUser,
  listApplicationsForUser,
  listEmailsForApplication,
  getEmailDetailById,
} from "../processTracking/pt.service.js";

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

        return {
          sync: syncResult.sync,
          emails: emailDetails,
        };
    };

    // Todo
    // if there more functions in the furture

    const error = new Error(`Unsupported MCP message: ${String(message)}`);
    error.statusCode = 400;
    throw error;
};

export { runProgressTracking };
