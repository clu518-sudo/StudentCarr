import { mcpDispatcherSchema, validate } from "./mcp.schemas.js";
import { runService, getManualProfile } from "./mcp.service.js";
import { renderManualProfileText } from "./profileText.js";

const formatZodError = (error) => {
  if (!error?.issues) return "Invalid request payload";
  return error.issues
    .map((issue) => `${issue.path.join(".") || "field"}: ${issue.message}`)
    .join(", ");
};

const mcpDispatcher = async (req, res, next) => {
    try {
        const payload = validate(mcpDispatcherSchema, req.body || {});
        const result = await runService(
            req.user.id,
            payload.message,
        );

        // MCP response
        return res.json({success: true, data: result}); 
        // result: {processedMessages: ,upsertedApplications: ,scannedMessages: ,relevantMessages:,firstSyncCompletedAt: ,};
    } catch (error) {
        if (error.name === "ZodError") {
            return res.status(400).json({success: false, error: formatZodError(error)});
        }
        return next(error);
    } 
};

// userId comes from the verified scoped token, never from the request body.
// The service keeps returning structured data; only this boundary renders the
// plain-text view the model reads.
const mcpProfile = async (req, res, next) => {
    try {
        const { profile } = await getManualProfile(req.user.id);
        return res.json({
            success: true,
            data: { profileText: renderManualProfileText(profile) },
        });
    } catch (error) {
        return next(error);
    }
};

export { mcpDispatcher, mcpProfile };