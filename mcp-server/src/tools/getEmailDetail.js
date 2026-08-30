import { callStudentCarr, toMcpResult } from "../apiClient.js";

export const definition = {
  name: "get_email_detail",
  description:
    "Read the full text of ONE stored job-application email thread, including every reply in order. Use this only when the summary from list_application_emails is not enough — when the answer depends on the exact wording of the message, such as a proposed interview time, what the user was asked to bring, or a specific instruction from the employer. Call list_application_emails first to find the emailId; do not guess one. Bodies are returned as plain text with quoted reply chains removed, and long messages are truncated. Read-only: it never scans Gmail and never changes the user's data.",
  inputSchema: {
    type: "object",
    properties: {
      emailId: {
        type: "string",
        description:
          "The id of the email thread, as returned by list_application_emails.",
      },
    },
    required: ["emailId"],
    additionalProperties: false,
  },
};

export const handler = async (args = {}, context = {}) =>
  toMcpResult(
    await callStudentCarr(
      "/api/mcp/emails/detail",
      { emailId: args?.emailId },
      context.authHeader,
    ),
  );
