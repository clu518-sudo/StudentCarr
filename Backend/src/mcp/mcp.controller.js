import { mcpDispatcherSchema, validate } from "./mcp.schemas.js";
import { runService } from "./mcp.service.js";

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

export { mcpDispatcher }; 