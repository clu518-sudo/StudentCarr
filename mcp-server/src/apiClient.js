// Thin HTTP wrapper around the StudentCarr API.
// Centralizes auth, base URL, and status-code -> tool-error mapping

const buildEndpoint = (path) => {
  const base = process.env.STUDENTCARR_API_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};

// Returns { ok: true, data } or { ok: false, errorMessage }. Never throws.
export const callStudentCarr = async (path, body) => {
    const endpoint = buildEndpoint(path);
    let response;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.STUDENTCARR_API_KEY}`,
            },
            body: JSON.stringify(body),
        });
    } catch (err) {
        return {
            ok: false,
            errorMessage: `Network error contacting StudentCarr at ${endpoint}. Check STUDENTCARR_API_URL and your connection, then retry. (${err?.message || err})`,
        };
    }

    let payload = null;
    try { payload = await response.json(); } catch {/* non-JSON body */};

    if (response.status === 401) {
        return {
            ok: false,
            errorMessage: "StudentCarr rejected the API key (401). Generate a new key in the web app under 'Connect to Claude Desktop' and update this extension's API key setting.",
        };
    }

    if (response.status === 403) {
        return {
            ok: false,
            errorMessage: "StudentCarr says Gmail is not connected (403). Open the web app and reconnect Gmail under Progress Tracking.",
        };
    }

    if (!response.ok) {
        return {
            ok: false,
            errorMessage: `StudentCarr returned HTTP ${response.status}: ${payload?.error || "Unknown error"}`,
        };
    }

    return { ok: true, data: payload?.data ?? payload ?? {} };
}

// Convert a callStudentCarr result into the shape an MCP CallTool handler must return.
export const toMcpResult = (result) =>
  result.ok
    ? { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] }
    : { isError: true, content: [{ type: "text", text: result.errorMessage }] };