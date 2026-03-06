import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types';

const SETTINGS_FILE = 'settings.json';

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
}

export function load(): AppSettings {
  const filePath = getSettingsPath();
  if (!fs.existsSync(filePath)) return { ...DEFAULT_SETTINGS };

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const saved = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function save(settings: AppSettings): void {
  const filePath = getSettingsPath();
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}
