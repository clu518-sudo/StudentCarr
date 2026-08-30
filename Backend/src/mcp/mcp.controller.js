import {
  mcpApplicationEmailsSchema,
  mcpEmailDetailSchema,
  validate,
} from "./mcp.schemas.js";
import {
  getEmailDetail,
  getManualProfile,
  listApplicationEmails,
  listApplications,
} from "./mcp.service.js";
import { renderManualProfileText } from "./profileText.js";

const formatZodError = (error) => {
  if (!error?.issues) return "Invalid request payload";
  return error.issues
    .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
    .join(", ");
};

// userId comes from the verified scoped token, never from the request body.
// applicationId/emailId are legitimate tool arguments, but every query using
// them stays scoped by userId in pt.service.js, so a guessed id cannot reach
// another user's row.
const withUser = (run) => async (req, res, next) => {
  try {
    return res.json({ success: true, data: await run(req) });
  } catch (error) {
    if (error.name === "ZodError") {
      return res
        .status(400)
        .json({ success: false, error: formatZodError(error) });
    }
    return next(error);
  }
};

const mcpApplications = withUser((req) => listApplications(req.user.id));

const mcpApplicationEmails = withUser((req) =>
  listApplicationEmails(
    req.user.id,
    validate(mcpApplicationEmailsSchema, req.body || {}),
  ),
);

const mcpEmailDetail = withUser((req) =>
  getEmailDetail(
    req.user.id,
    validate(mcpEmailDetailSchema, req.body || {}).emailId,
  ),
);

// The service keeps returning structured data; only this boundary renders the
// plain-text view the model reads.
const mcpProfile = withUser(async (req) => {
  const { profile } = await getManualProfile(req.user.id);
  return { profileText: renderManualProfileText(profile) };
});

export { mcpApplicationEmails, mcpApplications, mcpEmailDetail, mcpProfile };
