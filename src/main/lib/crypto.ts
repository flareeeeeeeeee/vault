import * as crypto from 'crypto';

const PBKDF2_ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ALGORITHM = 'aes-256-gcm';

export function deriveKey(password: string, salt?: Buffer): { key: Buffer; salt: Buffer } {
  const s = salt ?? crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(password, s, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512');
  return { key, salt: s };
}

export function encrypt(plaintext: string, key: Buffer, salt: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Pack: [salt(32)][iv(12)][authTag(16)][encrypted(...)]
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

export function decrypt(packed: Buffer, key: Buffer): string {
  const salt = packed.subarray(0, SALT_LENGTH);
  const iv = packed.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = packed.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = packed.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function generateId(): string {
  return crypto.randomUUID();
}
