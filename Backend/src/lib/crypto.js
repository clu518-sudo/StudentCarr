import crypto from "crypto";
import env from "../config/env.js";

const toBufferKey = () => {
  if (!env.fieldEncryptionKey) {
    return null;
  }

  if (/^[0-9a-fA-F]{64}$/.test(env.fieldEncryptionKey)) {
    return Buffer.from(env.fieldEncryptionKey, "hex");
  }

  const fromBase64 = Buffer.from(env.fieldEncryptionKey, "base64");
  if (fromBase64.length === 32) {
    return fromBase64;
  }

  return null;
};

const fieldKey = toBufferKey();

const encryptText = (plainText) => {
  if (!fieldKey) {
    return plainText;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", fieldKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

const decryptText = (encodedValue) => {
  if (!fieldKey || !encodedValue) {
    return encodedValue;
  }

  const [ivHex, tagHex, dataHex] = String(encodedValue).split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid encrypted field format");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    fieldKey,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};

const hashValue = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");

const generateOpaqueToken = () => crypto.randomBytes(64).toString("hex");

export { encryptText, decryptText, hashValue, generateOpaqueToken };
