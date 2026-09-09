// Single source of truth for which tools this server exposes.
// To add a tool:
//   1) create ./<name>.js exporting { definition, handler }
//   2) import it here and add it to the `tools` array
// Nothing else needs to change.
//
// SETTLED (MCP_CHATBOT plan §4.6/§11.5): no dedicated get_current_context /
// page-awareness tool. CareerChatbot.jsx never sends currentSection or path
// (and must not — see plan §4.6), so a literal "what page is the user on"
// tool would have no server-side signal to report. The actual need behind
// that question — grounding answers in the user's real account state rather
// than guessing — is already fully served by list_applications,
// list_application_emails, get_email_detail, and get_user_profile below: the
// model calls whichever is relevant to the question asked. This closes the
// open question rather than leaving it pending.

import * as listApplications from "./listApplications.js";
import * as listApplicationEmails from "./listApplicationEmails.js";
import * as getEmailDetail from "./getEmailDetail.js";
import * as getProfile from "./getProfile.js";
// import * as myNextTool from "./myNextTool.js";

const tools = [
  listApplications,
  listApplicationEmails,
  getEmailDetail,
  getProfile,
  // nextTool
];

export const toolDefinitions = tools.map((tool) => tool.definition);

const handlerByName = new Map(
  tools.map((tool) => [tool.definition.name, tool.handler]),
);
export const getHandler = (name) => handlerByName.get(name);
