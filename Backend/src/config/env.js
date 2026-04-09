import dotenv from "dotenv";

dotenv.config();

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: toNumber(process.env.PORT, 4000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL || "file:./dev.db",
  accessTokenSecret: process.env.JWT_ACCESS_SECRET || "dev_access_secret_change_me",
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_change_me",
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL || "30d",
  refreshCookieName: process.env.REFRESH_COOKIE_NAME || "refresh_token",
  fieldEncryptionKey: process.env.FIELD_ENCRYPTION_KEY || "",
};

const isProduction = env.nodeEnv === "production";
env.isProduction = isProduction;

export default env;
