import env from "../config/env.js";

const OCR_PROMPT = [
  "You are extracting text from a single PDF page image.",
  "Return only the readable text from the page in plain text.",
  "Preserve headings, bullets, and line breaks where they are clear.",
  "Do not summarize, explain, or add commentary.",
].join(" ");

const toDataUrl = (imageBuffer) =>
  `data:image/png;base64,${imageBuffer.toString("base64")}`;

const extractTextContent = (messageContent) => {
  if (typeof messageContent === "string") {
    return messageContent.trim();
  }

  if (!Array.isArray(messageContent)) {
    return "";
  }

  return messageContent
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (part?.type === "text" && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("\n")
    .trim();
};

const extractTextFromImageWithVllm = async (imageBuffer) => {
  if (!env.vllmBaseUrl || !env.vllmModel) {
    const error = new Error(
      "VLLM_BASE_URL and VLLM_MODEL must be configured for OCR fallback",
    );
    error.statusCode = 500;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.vllmTimeoutMs);

  try {
    const response = await fetch(`${env.vllmBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.vllmApiKey
          ? { Authorization: `Bearer ${env.vllmApiKey}` }
          : {}),
      },
      body: JSON.stringify({
        model: env.vllmModel,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: OCR_PROMPT,
              },
              {
                type: "image_url",
                image_url: {
                  url: toDataUrl(imageBuffer),
                },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(body || "vLLM OCR request failed");
      error.statusCode = 502;
      throw error;
    }

    const payload = await response.json();
    const content = extractTextContent(payload?.choices?.[0]?.message?.content);

    if (!content) {
      const error = new Error("vLLM OCR returned empty text");
      error.statusCode = 502;
      throw error;
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
};

export { extractTextFromImageWithVllm };
