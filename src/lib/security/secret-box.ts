import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Secret box — AES-256-GCM encryption for provider credentials at rest
 * (e.g. Deriv OAuth tokens stored in DerivAccount.tokenEncrypted).
 *
 * Key material: ENCRYPTION_KEY (64 hex chars) when provided; otherwise derived
 * from SESSION_SECRET with a distinct domain string. Raw secrets are never
 * logged or returned by any API route — only decryptSecret() server-side.
 *
 * Box format: v1.<iv-b64url>.<tag-b64url>.<ciphertext-b64url>
 */

function boxKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw && /^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  const seed = process.env.SESSION_SECRET ?? "";
  if (!seed) {
    throw new Error("ENCRYPTION_KEY or SESSION_SECRET must be set to store provider credentials");
  }
  return createHash("sha256").update(`bdo-secret-box:${seed}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", boxKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const b64 = (buf: Buffer) => buf.toString("base64url");
  return `v1.${b64(iv)}.${b64(tag)}.${b64(ct)}`;
}

export function decryptSecret(box: string): string {
  const [v, iv, tag, ct] = box.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("malformed secret box");
  const decipher = createDecipheriv("aes-256-gcm", boxKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
