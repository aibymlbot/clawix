import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const keyHex = process.env['PROVIDER_ENCRYPTION_KEY'];
  if (!keyHex || keyHex.length === 0) {
    throw new Error(
      'PROVIDER_ENCRYPTION_KEY is required. Set a 64-character hex string (32 bytes).',
    );
  }
  if (keyHex.length !== 64) {
    throw new Error(
      `PROVIDER_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes); got ${keyHex.length}.`,
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-delimited string: `iv:ciphertext:authTag` (all base64-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${authTag.toString('base64')}`;
}

/**
 * Decrypts a ciphertext string produced by `encrypt`.
 * Throws on authentication failure (tampered ciphertext) or malformed input.
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivB64, encB64, tagB64] = ciphertext.split(':');
  if (!ivB64 || !encB64 || !tagB64) {
    throw new Error('Invalid ciphertext format — expected iv:ciphertext:authTag');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const encrypted = Buffer.from(encB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Returns a masked representation of an API key suitable for display.
 * Keys of 8 characters or fewer are fully masked as `****`.
 * Longer keys show a prefix hint and the last 4 characters: `sk-***...1234`.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return `sk-***...${key.slice(-4)}`;
}
