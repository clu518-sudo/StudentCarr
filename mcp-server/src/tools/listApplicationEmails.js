import { callStudentCarr, toMcpResult } from "../apiClient.js";

export const definition = {
  name: "list_application_emails",
  description:
    "List the job-application email threads StudentCarr has stored for the signed-in user, newest first. Each result gives the sender, subject, date, detected intent, reply count, and an AI-written summary of what the message said — enough to answer most questions about how an employer responded or where things stand. Message bodies are NOT included; if the answer depends on wording only the original contains (a proposed interview time, what to bring, a specific instruction), call get_email_detail for that one email. Pass applicationId to scope to a single application (get it from list_applications), or omit it to search across all of them. Results are paginated: if nextCursor is not null there are more, and you can pass it back as cursor. Read-only: it never scans Gmail and never changes the user's data.",
  inputSchema: {
    type: "object",
    properties: {
      applicationId: {
        type: "string",
        description:
          "Restrict to one application, as returned by list_applications. Omit to list across every application.",
      },
      intent: {
        type: "string",
        description:
          "Restrict to one detected intent, e.g. \"invite\" or \"rejection\". Omit unless the user asked for a specific kind of message.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "How many threads to return. Defaults to 20.",
      },
      cursor: {
        type: "string",
        description:
          "The nextCursor value from a previous call, to fetch the following page.",
      },
    },
    additionalProperties: false,
  },
};

export const handler = async (args = {}, context = {}) =>
  toMcpResult(
    await callStudentCarr("/api/mcp/emails", args || {}, context.authHeader),
  );
