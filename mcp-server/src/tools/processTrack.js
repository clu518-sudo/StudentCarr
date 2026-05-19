import { callStudentCarr, toMcpResult } from "../apiClient.js";

export const definition = {
    name: "process_track",
    description: "Send an instruction to StudentCarr which is a carrier building AI assistant. Currently supported message tag: 'getEmails' — syncs the user's Gmail and returns aggregated job-application emails.",
    inputSchema: {
        type: "object",
        properties: {
            message: {
                type: "string",
                description: "Routing tag understood by StudentCarr's MCP dispatcher. Use 'getEmails' to fetch the latest job-application emails.",
            },
        },
        required: ["message"],
    },
};

export const handler = async (args) => {
    const message = args?.message;
    if(typeof message !== "string" || message.trim() === "") {
        return {
            isError: true,
            content: [{ type: "text", text: "Missing required argument: message" }]
        };
    }
    const result = await callStudentCarr("/api/mcp", { message })
    return toMcpResult(result);
}