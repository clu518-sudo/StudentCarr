import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"; 

const API_KEY = process.env.API_KEY;
const API_URL = process.env.API_URL;

if (!API_KEY) {
    console.error("[studentcarr-mcp] STUDENTCARR_API_KEY is not set");
    process.exit(1);
}
if (!API_URL) {
    console.error("[studentcarr-mcp] STUDENTCARR_API_URL is not set");
    process.exit(1);  
}

