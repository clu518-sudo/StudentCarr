import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"; 
import { toolDefinitions, getHandler } from "./tools/index.js";

const API_KEY = process.env.STUDENTCARR_API_KEY;
const API_URL = process.env.STUDENTCARR_API_URL;

if (!API_KEY) {
    console.error("[studentcarr-mcp] STUDENTCARR_API_KEY is not set");
    process.exit(1);
}
if (!API_URL) {
    console.error("[studentcarr-mcp] STUDENTCARR_API_URL is not set");
    process.exit(1);  
}

const server = new Server(
    { name: "studentcarr", version: "0.1.0" },
    { capabilities: { tools: {} } },
)


server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const handler = getHandler(request.params.name);
    if (!handler) {
        return {
            isError: true,
            content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
        };
    }
    return handler(request.params.arguments);
});

const transport = new StdioServerTransport();
await server.connect(transport);

