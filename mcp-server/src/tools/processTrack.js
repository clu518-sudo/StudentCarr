import { callStudentCarr, toMcpResult } from "../apiClient.js";

// Internal routing tag for the StudentCarr dispatcher. Kept out of the tool
// definition on purpose: the model never needs it, and exposing internal
// handler names invites probing for other tags.
const ROUTING_TAG = "getEmails";

export const definition = {
  name: "process_track",
  description:
    "Read the job-application emails StudentCarr has already stored for the signed-in user under Progress Tracking, including message bodies and thread replies, grouped by application. Use this to answer questions about which roles the user applied to, how employers replied, and where each application stands. Read-only: it never scans Gmail and never changes the user's data. Takes no arguments. If it comes back with no stored emails, tell the user there are no records yet and that they should open the Progress Tracking page in StudentCarr and press Sync.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export const handler = async (args, context = {}) => {
  const result = await callStudentCarr(
    "/api/mcp",
    { message: ROUTING_TAG },
    context.authHeader,
  );
  return toMcpResult(result);
};
