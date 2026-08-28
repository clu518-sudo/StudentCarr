import { callStudentCarr, toMcpTextResult } from "../apiClient.js";

export const definition = {
  name: "get_user_profile",
  description:
    "Read the signed-in user's StudentCarr profile exactly as they entered it under Profile Management > Manual Entry: personal info and headline, job preferences (target roles, locations, work authorization, salary, availability), education, work experience, projects, skills, and certifications. Use this whenever an answer depends on who the user is or what they have done — tailoring a resume or cover letter, judging fit against a job description, suggesting skills to learn, or filling in an application. Prefer it over asking the user to repeat details they have already saved. Long rich-text fields are returned as plain text and may be truncated. Takes no arguments: it always returns the calling user's own profile. An empty profile means the user has not filled in Manual Entry yet.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export const handler = async (args, context = {}) =>
  toMcpTextResult(
    await callStudentCarr("/api/mcp/profile", {}, context.authHeader),
    (data) => data?.profileText,
  );
