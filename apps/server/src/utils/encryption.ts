// ============================================================
// TELECAL — ENCRYPTION UTILITY
// AES-256-GCM authenticated encryption for sensitive fields.
// Used for: medical record fields, payment gateway responses,
// session recording storage keys.
//
// AES-256-GCM provides:
//   - Confidentiality (256-bit key)
//   - Integrity verification (authentication tag)
//   - Unique IV per encryption (prevents pattern analysis)
// ============================================================

import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;     // 128-bit IV
const TAG_LENGTH = 16;    // 128-bit auth tag
const KEY_LENGTH = 32;    // 256-bit key

// Derive a 32-byte key from the hex config value
const getKey = (): Buffer => {
  const key = Buffer.from(config.ENCRYPTION_KEY, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `Encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars)`,
    );
  }
  return key;
};

// ─── Encrypt ─────────────────────────────────────────────────

/**
 * Encrypts a string value.
 * Returns: iv:authTag:encryptedData (all hex-encoded, colon-separated)
 */
export const encrypt = (plaintext: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
};

// ─── Decrypt ─────────────────────────────────────────────────

/**
 * Decrypts a value produced by encrypt().
 * Throws if the data has been tampered with (auth tag mismatch).
 */
export const decrypt = (encryptedValue: string): string => {
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};

// ─── Hash (one-way, for tokens) ──────────────────────────────

/**
 * SHA-256 hash of a token for safe storage.
 * Used for: refresh tokens, password reset tokens, email verify tokens.
 * Never store raw tokens — only their hash.
 */
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generates a cryptographically secure random token.
 * @param bytes - Number of random bytes (default 32 = 256 bits)
 */
export const generateSecureToken = (bytes = 32): string => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Timing-safe string comparison.
 * Prevents timing attacks when comparing tokens.
 */
export const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};
