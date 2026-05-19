import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const archiver = require("archiver");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Backend/src/apiKeys/ → three levels up to repo root → into mcp-server/
const MCP_SERVER_DIR = path.resolve(__dirname, "../../../mcp-server");

// Embed the user's key + URL into manifest defaults so Claude Desktop's
// install dialog opens pre-filled and the user just clicks "Install".
const buildManifest = (apiKey, apiUrl) => ({
    dxt_version: "0.1",
    name: "studentcarr",
    version: "0.1.0",
    description: "Lets Claude Desktop reach your StudentCarr.",
    author: { name: "ludog" },
    server: {
        type: "node",
        entry_point: "server/index.js",
        mcp_config: {
            command: "node",
            args: ["${__dirname}/server/index.js"],
            env: {
                STUDENTCARR_API_KEY: "${user_config.api_key}",
                STUDENTCARR_API_URL: "${user_config.api_url}",
            },
        },
    },
    user_config: {
        api_key: {
            type: "string",
            title: "StudentCarr API key",
            description: "Generated under 'Connect to Claude Desktop'.",
            sensitive: true,
            required: true,
            default: apiKey,
        },
        api_url: {
            type: "string",
            title: "StudentCarr API URL",
            description: "Base URL of the StudentCarr server.",
            required: true,
            default: apiUrl,
        },
    },
});

const downloadBundle = (req, res, next) => {
    try {
        const { apiKey, apiUrl } = req.body || {};
        if (!apiKey || !/^sc_[A-Za-z0-9_\-]+$/.test(apiKey)) {
            return res
                .status(400)
                .json({ success: false, error: "Invalid apiKey" });
        }
        if (!apiUrl || !/^https?:\/\/.+/.test(apiUrl)) {
            return res
                .status(400)
                .json({ success: false, error: "Invalid apiUrl" });
        }

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="studentcarr.mcpb"',
        );

        const zip = archiver("zip", { zlib: { level: 9 } });
        zip.on("error", (err) => next(err));
        zip.pipe(res);

        // Top-level manifest with this user's key baked into defaults.
        zip.append(JSON.stringify(buildManifest(apiKey, apiUrl), null, 2), {
            name: "manifest.json",
        });

        // server/ subtree — Claude Desktop runs `node server/index.js`.
        zip.directory(path.join(MCP_SERVER_DIR, "src"), "server");
        zip.file(path.join(MCP_SERVER_DIR, "package.json"), {
            name: "server/package.json",
        });
        // Bundle node_modules: Claude Desktop does NOT run `npm install`.
        zip.directory(
            path.join(MCP_SERVER_DIR, "node_modules"),
            "server/node_modules",
        );

        zip.finalize();
    } catch (err) {
        return next(err);
    }
};

export { downloadBundle };