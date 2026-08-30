import { callStudentCarr, toMcpResult } from "../apiClient.js";

export const definition = {
  name: "list_applications",
  description:
    "List every job application StudentCarr has stored for the signed-in user under Progress Tracking: company, role, current status, when it last changed, and how many email threads it has. Start here for any question about which roles the user applied to or where an application stands — it is the cheap overview, and it gives you the applicationId needed to drill into emails with list_application_emails. Returns no message text. Read-only: it never scans Gmail and never changes the user's data. Takes no arguments. If it comes back with no records, tell the user there are none yet and that they should open the Progress Tracking page in StudentCarr and press Sync.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export const handler = async (args, context = {}) =>
  toMcpResult(
    await callStudentCarr("/api/mcp/applications", {}, context.authHeader),
  );
