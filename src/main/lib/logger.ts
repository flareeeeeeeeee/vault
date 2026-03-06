import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { encrypt, decrypt } from './crypto';
import { getKey, getSalt } from './vault';
import { LogEntry } from '../../shared/types';

const LOG_FILE = 'activity.log.enc';

function getLogPath(): string {
  return path.join(app.getPath('userData'), LOG_FILE);
}

export async function append(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
  const key = getKey();
  const salt = getSalt();
  if (!key || !salt) return;

  const logEntry: LogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  const entries = await read();
  entries.push(logEntry);

  const logPath = getLogPath();
  const tmpPath = logPath + '.tmp';
  const packed = encrypt(JSON.stringify(entries), key, salt);
  fs.writeFileSync(tmpPath, packed);
  fs.renameSync(tmpPath, logPath);
}

export async function read(): Promise<LogEntry[]> {
  const key = getKey();
  if (!key) return [];

  const logPath = getLogPath();
  if (!fs.existsSync(logPath)) return [];

  try {
    const packed = fs.readFileSync(logPath);
    const json = decrypt(packed, key);
    return JSON.parse(json) as LogEntry[];
  } catch {
    return [];
  }
}
