const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

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

    if (!response.body) {
      throw new Error("Streaming is not supported in this browser");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const processMessage = (rawMessage) => {
      const lines = rawMessage
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (!lines.length) {
        return;
      }

      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLines = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      const eventName = eventLine ? eventLine.slice(6).trim() : "message";
      const dataText = dataLines.join("\n");

      let payload = {};
      if (dataText) {
        try {
          payload = JSON.parse(dataText);
        } catch {
          payload = { message: dataText };
        }
      }

      onEvent(eventName, payload);
      if (eventName === "error") {
        throw new Error(payload?.error || "Profile generation failed");
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const messages = buffer.split("\n\n");
      buffer = messages.pop() || "";

      for (const message of messages) {
        processMessage(message);
      }
    }

    if (buffer.trim()) {
      processMessage(buffer);
    }
  },
};

export const progressTrackingApi = {
  listApplications: (token) =>
    apiRequest("/process-tracking/applications", { method: "GET" }, token),
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
