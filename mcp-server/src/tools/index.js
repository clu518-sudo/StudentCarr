// Single source of truth for which tools this server exposes.
// To add a tool:
//   1) create ./<name>.js exporting { definition, handler }
//   2) import it here and add it to the `tools` array
// Nothing else needs to change.

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
