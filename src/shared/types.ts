export interface PasswordEntry {
  id: string;
  service: string;
  username: string;
  password: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LogEntry {
  timestamp: string;
  action: 'unlock' | 'lock' | 'view' | 'copy' | 'add' | 'edit' | 'delete';
  target: string;
  detail: string;
}

export interface AppSettings {
  autoLockMinutes: number;       // 0 = disabled
  clipboardClearSeconds: number;  // 0 = disabled
  globalShortcut: string;
  passwordLength: number;
  startMinimized: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoLockMinutes: 5,
  clipboardClearSeconds: 10,
  globalShortcut: 'Ctrl+Shift+P',
  passwordLength: 20,
  startMinimized: false,
};

export interface ElectronAPI {
  vaultExists(): Promise<boolean>;
  unlock(masterPassword: string): Promise<PasswordEntry[]>;
  lock(): Promise<void>;
  save(entries: PasswordEntry[]): Promise<void>;
  logAppend(entry: Omit<LogEntry, 'timestamp'>): Promise<void>;
  logRead(): Promise<LogEntry[]>;
  copyToClip(text: string): Promise<boolean>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;
}
