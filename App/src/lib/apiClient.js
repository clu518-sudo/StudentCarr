import { streamSseResponse } from "./sseClient";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:10001/api";

const buildHeaders = (token, customHeaders = {}, hasFormData = false) => {
  const headers = {};

  if (!hasFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return {
    ...headers,
    ...customHeaders,
  };
};

export const apiRequest = async (path, options = {}, token = null) => {
  const responseType = options.responseType || "json";
  const hasFormData = Boolean(options.formData);
  const body = hasFormData
    ? options.formData
    : options.body
      ? JSON.stringify(options.body)
      : undefined;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: buildHeaders(token, options.headers, hasFormData),
    credentials: "include",
    body,
  });

  if (!response.ok) {
    let payload = null;
    let fallbackMessage = "Request failed";
    try {
      payload = await response.clone().json();
    } catch {
      try {
        const responseText = await response.text();
        if (responseText) {
          fallbackMessage = responseText;
        }
      } catch {
        // Keep default fallback error message.
      }
    }

    const error = new Error(payload?.error || "Request failed");
    error.status = response.status;
    error.payload = payload;
    if (!payload?.error && fallbackMessage) {
      error.message = fallbackMessage;
    }
    throw error;
  }

  if (responseType === "blob") {
    return response.blob();
  }

  if (responseType === "text") {
    return response.text();
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Ignore JSON parsing issues and return null when no payload is expected.
  }

  return payload;
};

export const authApi = {
  signup: (body) => apiRequest("/auth/signup", { method: "POST", body }),
  login: (body) => apiRequest("/auth/login", { method: "POST", body }),
  googleLoginStart: () => apiRequest("/auth/google/start", { method: "GET" }),
  refresh: () => apiRequest("/auth/refresh", { method: "POST" }),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),
  me: (token) => apiRequest("/auth/me", { method: "GET" }, token),
};

export const profileManagementApi = {
  getProfile: (token) =>
    apiRequest("/profile-management", { method: "GET" }, token),
  updateManualProfile: (body, token) =>
    apiRequest("/profile-management/manual", { method: "PUT", body }, token),
  getDocuments: (token) =>
    apiRequest("/profile-management/documents", { method: "GET" }, token),
  uploadDocuments: ({ files, documentTypes, githubUrl }, token) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("documents", file));
    documentTypes.forEach((type) => formData.append("documentTypes", type));
    if (githubUrl) {
      formData.append("githubUrl", githubUrl);
    }

    return apiRequest(
      "/profile-management/documents",
      {
        method: "POST",
        formData,
      },
      token,
    );
  },
  uploadSingleDocument: ({ file, documentType, githubUrl }, token) => {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("documentType", documentType);
    if (githubUrl) {
      formData.append("githubUrl", githubUrl);
    }

    return apiRequest(
      "/profile-management/documents/single",
      {
        method: "POST",
        formData,
      },
      token,
    );
  },
  deleteDocument: (documentId, token) =>
    apiRequest(
      `/profile-management/documents/${documentId}`,
      { method: "DELETE" },
      token,
    ),
  downloadDocument: (documentId, token) =>
    apiRequest(
      `/profile-management/documents/${documentId}/download`,
      { method: "GET", responseType: "blob" },
      token,
    ),
  subscribeEvents: async ({ onEvent = () => {}, signal }, token) => {
    const response = await fetch(`${API_BASE_URL}/events`, {
      method: "GET",
      headers: buildHeaders(token),
      credentials: "include",
      signal,
    });

    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        // Ignore parsing failure and use fallback message.
      }

      throw new Error(payload?.error || "Failed to subscribe to events");
    }

    await streamSseResponse(response, {
      onEvent,
      errorEventMessage: "Event stream failed",
    });
  },
  generateManualProfileStream: async (
    { sectionName, onEvent = () => {}, signal },
    token,
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/profile-management/manual/generate/stream`,
      {
        method: "POST",
        headers: buildHeaders(token),
        credentials: "include",
        body: JSON.stringify({ sectionName }),
        signal,
      },
    );

    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        // Ignore parsing failure and use fallback message.
      }

      throw new Error(payload?.error || "Failed to start profile generation");
    }
    await streamSseResponse(response, {
      onEvent,
      errorEventMessage: "Profile generation failed",
    });
  },
};

export const progressTrackingApi = {
  getGmailStatus: (token) =>
    apiRequest("/process-tracking/gmail/status", { method: "GET" }, token),
  connectGmail: (token) =>
    apiRequest("/process-tracking/gmail/connect", { method: "POST" }, token),
  disconnectGmail: (token) =>
    apiRequest("/process-tracking/gmail/connect", { method: "DELETE" }, token),
  syncMailbox: (token) =>
    apiRequest("/process-tracking/sync", { method: "POST" }, token),
  listApplications: (token) =>
    apiRequest("/process-tracking/applications", { method: "GET" }, token),
  deleteApplications: (applicationIds, token) =>
    apiRequest(
      "/process-tracking/applications",
      {
        method: "DELETE",
        body: { applicationIds },
      },
      token,
    ),
  listApplicationEmails: (applicationId, token) =>
    apiRequest(
      `/process-tracking/applications/${applicationId}/emails`,
      { method: "GET" },
      token,
    ),
  getEmailDetail: (emailId, token) =>
    apiRequest(`/process-tracking/emails/${emailId}`, { method: "GET" }, token),
  getInviteReplyDraft: (emailId, token) =>
    apiRequest(
      `/process-tracking/emails/${emailId}/reply-draft`,
      { method: "GET" },
      token,
    ),
  confirmInviteReply: ({ emailId, draftText }, token) =>
    apiRequest(
      `/process-tracking/emails/${emailId}/reply-confirm`,
      {
        method: "POST",
        body: { draftText },
      },
      token,
    ),
};

// API client for the MCP API-key management endpoints.
// Backend routes are mounted under /api/keys behind requireAuth (JWT),
// so every call must pass the user's accessToken (same pattern as the other *Api objects in this file).
export const apiKeysApi = {

  // GET /api/keys
  // Returns the user's active (non-revoked) keys with a masked preview only.
  // Shape: { success: true, data: [{ id, label, lastUsedAt, createdAt, maskedKey }] }
  list: (token) => apiRequest("/keys", {method: "GET"}, token),

  // POST /api/keys
  // Creates a new key for the current user. The raw `key` is returned ONCE here;
  // it is never retrievable again (backend only stores the SHA-256 hash).
  // body: { label?: string }
  // Shape: { success: true, data: { id, label, createdAt, key } }
  create:  (body, token) => apiRequest("/keys", {method: "POST"}, token),

  // DELETE /api/keys/:id
  // Soft-revokes a key (sets revoked=true). Scoped by userId on the backend,
  // so users can only revoke their own keys.
  // Shape: { success: true, data: { id, revoked: true } }
  revoke: (id, token) => apiRequest(`/keys/${id}`, {method:"DELETE"}, token),
};
