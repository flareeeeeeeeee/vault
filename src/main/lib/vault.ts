import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { deriveKey, encrypt, decrypt } from './crypto';
import { PasswordEntry } from '../../shared/types';

const VAULT_FILE = 'vault.enc';

let derivedKey: Buffer | null = null;
let derivedSalt: Buffer | null = null;

function getVaultPath(): string {
  return path.join(app.getPath('userData'), VAULT_FILE);
}

export function exists(): boolean {
  return fs.existsSync(getVaultPath());
}

export async function unlock(masterPassword: string): Promise<PasswordEntry[]> {
  const vaultPath = getVaultPath();

  if (!fs.existsSync(vaultPath)) {
    // First time: create new vault
    const { key, salt } = deriveKey(masterPassword);
    derivedKey = key;
    derivedSalt = salt;
    const packed = encrypt(JSON.stringify([]), key, salt);
    fs.writeFileSync(vaultPath, packed);
    return [];
  }

  const packed = fs.readFileSync(vaultPath);
  // Extract salt from packed data (first 32 bytes)
  const salt = packed.subarray(0, 32);
  const { key } = deriveKey(masterPassword, salt);

  // This will throw if password is wrong (auth tag mismatch)
  const json = decrypt(packed, key);
  derivedKey = key;
  derivedSalt = salt;
  return JSON.parse(json) as PasswordEntry[];
}

export function lock(): void {
  if (derivedKey) {
    derivedKey.fill(0);
    derivedKey = null;
  }
  derivedSalt = null;
}

export async function save(entries: PasswordEntry[]): Promise<void> {
  if (!derivedKey || !derivedSalt) {
    throw new Error('Vault is locked');
  }

  const vaultPath = getVaultPath();
  const tmpPath = vaultPath + '.tmp';
  const packed = encrypt(JSON.stringify(entries), derivedKey, derivedSalt);

  fs.writeFileSync(tmpPath, packed);
  fs.renameSync(tmpPath, vaultPath);
}

export function isUnlocked(): boolean {
  return derivedKey !== null;
}

export function getKey(): Buffer | null {
  return derivedKey;
}

export function getSalt(): Buffer | null {
  return derivedSalt;
}
