import dotenv from "dotenv";

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 10001),
  corsOrigin:
    process.env.CORS_ORIGIN ||
    "http://localhost:10003,http://127.0.0.1:10003",
  appBaseUrl:
    process.env.APP_BASE_URL ||
    "http://localhost:10003",
  databaseUrl: process.env.DATABASE_URL || "file:./dev.db",
  accessTokenSecret: process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me",
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_change_me",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "30d",
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || "refresh_token",
  fieldEncryptionKey: process.env.FIELD_ENCRYPTION_KEY || "",
  documentParserConcurrency: toNumber(process.env.DOCUMENT_PARSER_CONCURRENCY, 1),
  documentParserMinCharacters: toNumber(
    process.env.DOCUMENT_PARSER_MIN_CHARACTERS,
    200,
  ),
  documentParserRenderScale: toNumber(
    process.env.DOCUMENT_PARSER_RENDER_SCALE,
    1.5,
  ),
  vllmBaseUrl: process.env.VLLM_BASE_URL || "",
  vllmModel: process.env.VLLM_MODEL || "",
  vllmApiKey: process.env.VLLM_API_KEY || "",
  vllmTimeoutMs: toNumber(process.env.VLLM_TIMEOUT_MS, 120000),
  gmailClientId: process.env.GMAIL_CLIENT_ID || "",
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET || "",
  gmailRedirectUri:
    process.env.GMAIL_REDIRECT_URI ||
    "http://localhost:10001/api/process-tracking/gmail/callback",
  progressTrackingServiceBaseUrl:
    process.env.PROGRESS_TRACKING_SERVICE_BASE_URL || "http://127.0.0.1:10002",
};

const isProduction = env.nodeEnv === "production";
env.isProduction = isProduction;

export default env;
