// Thin HTTP wrapper around the StudentCarr API.
// Centralizes auth, base URL, and status-code -> tool-error mapping

const DEFAULT_API_URL = "http://127.0.0.1:10001";

const buildEndpoint = (path) => {
  const base = (process.env.STUDENTCARR_API_URL || DEFAULT_API_URL).replace(
    /\/$/,
    "",
  );
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
};

// Returns { ok: true, data } or { ok: false, errorMessage }. Never throws.
export const callStudentCarr = async (path, body, authHeader) => {
  const endpoint = buildEndpoint(path);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
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
  try {
    payload = await response.json();
  } catch {
    /* non-JSON body */
  }

  if (response.status === 401) {
    return {
      ok: false,
      errorMessage:
        "StudentCarr rejected the request (401): the session token is missing or has expired. A fresh token is minted per chat turn — ask the user to retry.",
    };
  }

  if (response.status === 403) {
    return {
      ok: false,
      errorMessage:
        "StudentCarr says Gmail is not connected (403). Open the web app and reconnect Gmail under Progress Tracking.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      errorMessage: `StudentCarr returned HTTP ${response.status}: ${payload?.error || "Unknown error"}`,
    };
  }

  return { ok: true, data: payload?.data ?? payload ?? {} };
};

// Convert a callStudentCarr result into the shape an MCP CallTool handler must return.
export const toMcpResult = (result) =>
  result.ok
    ? {
        content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }],
      }
    : { isError: true, content: [{ type: "text", text: result.errorMessage }] };

// Same error mapping, but for endpoints that already render their own text for
// the model. `pickText` selects it from the response payload.
export const toMcpTextResult = (result, pickText) =>
  result.ok
    ? { content: [{ type: "text", text: pickText(result.data) || "" }] }
    : { isError: true, content: [{ type: "text", text: result.errorMessage }] };
