import { app, BrowserWindow, ipcMain, clipboard, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';
import * as vault from './lib/vault';
import * as logger from './lib/logger';
import * as settings from './lib/settings';
import { AppSettings } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let clipboardTimer: ReturnType<typeof setTimeout> | null = null;
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;
let isQuitting = false;
let currentSettings: AppSettings;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0a0a0f',
    autoHideMenuBar: true,
    show: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (mainWindow && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function toggleWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function createTray(): void {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '..', '..', 'build', 'icon.ico')
    : path.join(__dirname, '..', '..', 'build', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('Vault');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show/Hide', click: toggleWindow },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        vault.lock();
        app.quit();
      },
    },
  ]);

  tray.on('click', toggleWindow);
  tray.on('right-click', () => {
    tray?.popUpContextMenu(contextMenu);
  });
}

// Auto-lock management
function resetAutoLock(): void {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }

  if (!vault.isUnlocked() || currentSettings.autoLockMinutes <= 0) return;

  autoLockTimer = setTimeout(() => {
    vault.lock();
    mainWindow?.webContents.send('auto-locked');
    autoLockTimer = null;
  }, currentSettings.autoLockMinutes * 60_000);
}

function registerShortcut(shortcut: string): void {
  globalShortcut.unregisterAll();
  try {
    globalShortcut.register(shortcut, toggleWindow);
  } catch {
    // Fallback if custom shortcut is invalid
    globalShortcut.register('Ctrl+Shift+P', toggleWindow);
  }
}

// IPC Handlers
ipcMain.handle('vault:exists', () => vault.exists());

ipcMain.handle('vault:unlock', async (_event, masterPassword: string) => {
  const entries = await vault.unlock(masterPassword);
  resetAutoLock();
  return entries;
});

ipcMain.handle('vault:lock', async () => {
  vault.lock();
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
});

ipcMain.handle('vault:save', async (_event, entries) => {
  await vault.save(entries);
  resetAutoLock();
});

ipcMain.handle('log:append', async (_event, entry) => {
  await logger.append(entry);
});

ipcMain.handle('log:read', async () => {
  return logger.read();
});

ipcMain.handle('clipboard:copy', async (_event, text: string) => {
  clipboard.writeText(text);

  if (clipboardTimer) clearTimeout(clipboardTimer);
  const clearSeconds = currentSettings.clipboardClearSeconds;
  if (clearSeconds > 0) {
    clipboardTimer = setTimeout(() => {
      if (clipboard.readText() === text) {
        clipboard.writeText('');
      }
      clipboardTimer = null;
    }, clearSeconds * 1000);
  }

  return true;
});

ipcMain.handle('settings:get', () => {
  return currentSettings;
});

ipcMain.handle('settings:save', async (_event, newSettings: AppSettings) => {
  const oldShortcut = currentSettings.globalShortcut;
  currentSettings = { ...newSettings };
  settings.save(currentSettings);

  if (newSettings.globalShortcut !== oldShortcut) {
    registerShortcut(newSettings.globalShortcut);
  }

  resetAutoLock();
});

app.whenReady().then(() => {
  currentSettings = settings.load();

  createWindow();
  createTray();
  registerShortcut(currentSettings.globalShortcut);

  mainWindow?.once('ready-to-show', () => {
    if (!currentSettings.startMinimized) {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  // stays in tray
});

app.on('before-quit', () => {
  isQuitting = true;
  vault.lock();
  globalShortcut.unregisterAll();
});
