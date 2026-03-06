interface PasswordEntry {
  id: string;
  service: string;
  username: string;
  password: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface LogEntry {
  timestamp: string;
  action: 'unlock' | 'lock' | 'view' | 'copy' | 'add' | 'edit' | 'delete';
  target: string;
  detail: string;
}

interface AppSettings {
  autoLockMinutes: number;
  clipboardClearSeconds: number;
  globalShortcut: string;
  passwordLength: number;
  startMinimized: boolean;
}

interface ElectronAPI {
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

declare var api: ElectronAPI;
declare var onAutoLocked: (callback: () => void) => void;

// ===== State =====
let entries: PasswordEntry[] = [];
let currentView: 'passwords' | 'activity' | 'settings' = 'passwords';
let appSettings: AppSettings;
let editingId: string | null = null;
let revealedIds = new Set<string>();
let deleteTargetId: string | null = null;
let isFirstRun = false;

// ===== DOM Elements =====
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const lockScreen = $<HTMLDivElement>('lock-screen');
const lockSubtitle = $<HTMLParagraphElement>('lock-subtitle');
const masterPasswordInput = $<HTMLInputElement>('master-password');
const unlockBtn = $<HTMLButtonElement>('unlock-btn');
const lockError = $<HTMLParagraphElement>('lock-error');
const app = $<HTMLDivElement>('app');
const searchInput = $<HTMLInputElement>('search-input');
const addBtn = $<HTMLButtonElement>('add-btn');
const entriesGrid = $<HTMLDivElement>('entries-grid');
const emptyState = $<HTMLDivElement>('empty-state');
const viewPasswords = $<HTMLDivElement>('view-passwords');
const viewActivity = $<HTMLDivElement>('view-activity');
const activityList = $<HTMLDivElement>('activity-list');
const activityEmpty = $<HTMLDivElement>('activity-empty');
const lockBtn = $<HTMLButtonElement>('lock-btn');
const modalOverlay = $<HTMLDivElement>('modal-overlay');
const modalTitle = $<HTMLHeadingElement>('modal-title');
const modalClose = $<HTMLButtonElement>('modal-close');
const modalCancel = $<HTMLButtonElement>('modal-cancel');
const modalSave = $<HTMLButtonElement>('modal-save');
const formService = $<HTMLInputElement>('form-service');
const formUsername = $<HTMLInputElement>('form-username');
const formPassword = $<HTMLInputElement>('form-password');
const formNotes = $<HTMLTextAreaElement>('form-notes');
const toggleFormPassword = $<HTMLButtonElement>('toggle-form-password');
const generatePassword = $<HTMLButtonElement>('generate-password');
const deleteOverlay = $<HTMLDivElement>('delete-overlay');
const deleteMessage = $<HTMLParagraphElement>('delete-message');
const deleteCancel = $<HTMLButtonElement>('delete-cancel');
const deleteConfirm = $<HTMLButtonElement>('delete-confirm');
const toast = $<HTMLDivElement>('toast');
const toastMessage = $<HTMLSpanElement>('toast-message');
const confirmWrap = $<HTMLDivElement>('confirm-wrap');
const confirmPasswordInput = $<HTMLInputElement>('confirm-password');
const viewSettings = $<HTMLDivElement>('view-settings');
const setAutolock = $<HTMLInputElement>('set-autolock');
const setClipboard = $<HTMLInputElement>('set-clipboard');
const setShortcut = $<HTMLInputElement>('set-shortcut');
const setPwdLength = $<HTMLInputElement>('set-pwdlength');
const setStartMin = $<HTMLInputElement>('set-startmin');
const settingsSaveBtn = $<HTMLButtonElement>('settings-save');

// ===== Toast =====
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string) {
  toastMessage.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('toast-success');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
    toastTimer = null;
  }, 2500);
}

// ===== Lock/Unlock =====
async function init() {
  const exists = await api.vaultExists();
  isFirstRun = !exists;
  if (isFirstRun) {
    lockSubtitle.textContent = 'Create a master password to get started';
    unlockBtn.textContent = 'Create Vault';
    confirmWrap.classList.remove('hidden');
  } else {
    lockSubtitle.textContent = 'Enter your master password';
    unlockBtn.textContent = 'Unlock';
    confirmWrap.classList.add('hidden');
  }
  unlockBtn.disabled = false;
}

async function handleUnlock() {
  const pwd = masterPasswordInput.value;
  if (!pwd) {
    lockError.textContent = 'Please enter a password';
    return;
  }

  if (isFirstRun) {
    if (pwd.length < 4) {
      lockError.textContent = 'Password must be at least 4 characters';
      return;
    }
    if (pwd !== confirmPasswordInput.value) {
      lockError.textContent = 'Passwords do not match';
      return;
    }
  }

  unlockBtn.disabled = true;
  lockError.textContent = '';

  try {
    entries = await api.unlock(pwd);
    await api.logAppend({ action: 'unlock', target: '', detail: 'Vault unlocked' });
    lockScreen.classList.add('hidden');
    app.classList.remove('hidden');
    masterPasswordInput.value = '';
    renderEntries();
  } catch (e: any) {
    lockError.textContent = 'Incorrect password or corrupted vault';
  } finally {
    unlockBtn.disabled = false;
  }
}

async function handleLock() {
  await api.logAppend({ action: 'lock', target: '', detail: 'Vault locked' });
  await api.lock();
  entries = [];
  revealedIds.clear();
  editingId = null;
  app.classList.add('hidden');
  lockScreen.classList.remove('hidden');
  lockError.textContent = '';
  searchInput.value = '';
  confirmPasswordInput.value = '';
  init();
}

// ===== SVG Icons =====
const ICONS = {
  eye: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  copy: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  trash: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
};

// ===== Render Entries =====
function renderEntries(filter?: string) {
  entriesGrid.innerHTML = '';
  let filtered = entries;
  if (filter) {
    const q = filter.toLowerCase();
    filtered = entries.filter(e =>
      e.service.toLowerCase().includes(q) || e.username.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  // Table header
  const thead = document.createElement('div');
  thead.className = 'table-header';
  thead.innerHTML = '<span class="th th-service">Service</span>' +
    '<span class="th th-username">Username</span>' +
    '<span class="th th-password">Password</span>' +
    '<span class="th th-actions">Actions</span>';
  entriesGrid.appendChild(thead);

  for (const entry of filtered) {
    const row = document.createElement('div');
    row.className = 'table-row';
    const isRevealed = revealedIds.has(entry.id);

    // Service cell
    const serviceCell = document.createElement('div');
    serviceCell.className = 'td td-service';
    const initial = document.createElement('div');
    initial.className = 'entry-service-initial';
    initial.textContent = entry.service.charAt(0).toUpperCase();
    const serviceName = document.createElement('span');
    serviceName.textContent = entry.service;
    serviceCell.appendChild(initial);
    serviceCell.appendChild(serviceName);
    row.appendChild(serviceCell);

    // Username cell
    const userCell = document.createElement('div');
    userCell.className = 'td td-username';
    const userText = document.createElement('span');
    userText.className = 'cell-text';
    userText.textContent = entry.username;
    userCell.appendChild(userText);
    const copyUserBtn = document.createElement('button');
    copyUserBtn.className = 'icon-btn icon-btn-inline';
    copyUserBtn.title = 'Copy username';
    copyUserBtn.innerHTML = ICONS.copy;
    copyUserBtn.addEventListener('click', async () => {
      await api.copyToClip(entry.username);
      await api.logAppend({ action: 'copy', target: entry.service, detail: 'Username copied' });
      showToast('Username copied!');
    });
    userCell.appendChild(copyUserBtn);
    row.appendChild(userCell);

    // Password cell
    const pwdCell = document.createElement('div');
    pwdCell.className = 'td td-password';
    const pwdText = document.createElement('span');
    pwdText.className = 'cell-text pwd-text' + (isRevealed ? ' revealed' : '');
    pwdText.textContent = isRevealed ? entry.password : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
    pwdCell.appendChild(pwdText);

    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'icon-btn icon-btn-inline';
    eyeBtn.title = isRevealed ? 'Hide' : 'Reveal';
    eyeBtn.innerHTML = isRevealed ? ICONS.eyeOff : ICONS.eye;
    eyeBtn.addEventListener('click', async () => {
      if (revealedIds.has(entry.id)) {
        revealedIds.delete(entry.id);
      } else {
        revealedIds.add(entry.id);
        await api.logAppend({ action: 'view', target: entry.service, detail: 'Password revealed' });
      }
      renderEntries(searchInput.value);
    });
    pwdCell.appendChild(eyeBtn);

    const copyPwdBtn = document.createElement('button');
    copyPwdBtn.className = 'icon-btn icon-btn-inline';
    copyPwdBtn.title = 'Copy password';
    copyPwdBtn.innerHTML = ICONS.copy;
    copyPwdBtn.addEventListener('click', async () => {
      await api.copyToClip(entry.password);
      await api.logAppend({ action: 'copy', target: entry.service, detail: 'Password copied (auto-clear 10s)' });
      showToast('Password copied! Clears in 10s');
    });
    pwdCell.appendChild(copyPwdBtn);
    row.appendChild(pwdCell);

    // Actions cell
    const actionsCell = document.createElement('div');
    actionsCell.className = 'td td-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'icon-btn';
    editBtn.title = 'Edit';
    editBtn.innerHTML = ICONS.edit;
    editBtn.addEventListener('click', () => openModal(entry));
    actionsCell.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn danger';
    delBtn.title = 'Delete';
    delBtn.innerHTML = ICONS.trash;
    delBtn.addEventListener('click', () => confirmDelete(entry));
    actionsCell.appendChild(delBtn);

    row.appendChild(actionsCell);
    entriesGrid.appendChild(row);
  }
}

// ===== Modal (Add/Edit) =====
function openModal(entry?: PasswordEntry) {
  editingId = entry?.id ?? null;
  modalTitle.textContent = entry ? 'Edit Password' : 'Add Password';
  formService.value = entry?.service ?? '';
  formUsername.value = entry?.username ?? '';
  formPassword.value = entry?.password ?? '';
  formPassword.type = 'password';
  formNotes.value = entry?.notes ?? '';
  modalOverlay.classList.remove('hidden');
  formService.focus();
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  editingId = null;
}

async function saveEntry() {
  const service = formService.value.trim();
  const username = formUsername.value.trim();
  const password = formPassword.value;
  const notes = formNotes.value.trim();

  if (!service || !username || !password) {
    showToast('Service, username, and password are required');
    return;
  }

  const now = new Date().toISOString();

  if (editingId) {
    const idx = entries.findIndex(e => e.id === editingId);
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], service, username, password, notes, updatedAt: now };
      await api.logAppend({ action: 'edit', target: service, detail: 'Entry updated' });
    }
  } else {
    const newEntry: PasswordEntry = {
      id: crypto.randomUUID(),
      service,
      username,
      password,
      notes,
      createdAt: now,
      updatedAt: now,
    };
    entries.push(newEntry);
    await api.logAppend({ action: 'add', target: service, detail: 'Entry added' });
  }

  await api.save(entries);
  closeModal();
  renderEntries(searchInput.value);
  showToast(editingId ? 'Password updated' : 'Password saved');
}

// ===== Delete =====
function confirmDelete(entry: PasswordEntry) {
  deleteTargetId = entry.id;
  deleteMessage.textContent = `Delete "${entry.service}" entry? This cannot be undone.`;
  deleteOverlay.classList.remove('hidden');
}

async function executeDelete() {
  if (!deleteTargetId) return;
  const entry = entries.find(e => e.id === deleteTargetId);
  entries = entries.filter(e => e.id !== deleteTargetId);
  await api.save(entries);
  if (entry) {
    await api.logAppend({ action: 'delete', target: entry.service, detail: 'Entry deleted' });
  }
  deleteTargetId = null;
  deleteOverlay.classList.add('hidden');
  renderEntries(searchInput.value);
  showToast('Password deleted');
}

// ===== Activity View =====
async function renderActivity() {
  const logs = await api.logRead();
  activityList.innerHTML = '';

  if (logs.length === 0) {
    activityEmpty.classList.remove('hidden');
    return;
  }

  activityEmpty.classList.add('hidden');

  // Show newest first
  for (const log of [...logs].reverse()) {
    const row = document.createElement('div');
    row.className = 'activity-row';

    const time = document.createElement('span');
    time.className = 'activity-time';
    time.textContent = new Date(log.timestamp).toLocaleString();
    row.appendChild(time);

    const badge = document.createElement('span');
    badge.className = `activity-badge badge-${log.action}`;
    badge.textContent = log.action;
    row.appendChild(badge);

    const target = document.createElement('span');
    target.className = 'activity-target';
    target.textContent = log.target || '-';
    row.appendChild(target);

    const detail = document.createElement('span');
    detail.className = 'activity-detail';
    detail.textContent = log.detail;
    row.appendChild(detail);

    activityList.appendChild(row);
  }
}

// ===== Settings =====
async function loadSettings() {
  appSettings = await api.getSettings();
}

function populateSettings() {
  setAutolock.value = String(appSettings.autoLockMinutes);
  setClipboard.value = String(appSettings.clipboardClearSeconds);
  setShortcut.value = appSettings.globalShortcut;
  setPwdLength.value = String(appSettings.passwordLength);
  setStartMin.checked = appSettings.startMinimized;
}

async function handleSaveSettings() {
  appSettings = {
    autoLockMinutes: Math.max(0, parseInt(setAutolock.value) || 0),
    clipboardClearSeconds: Math.max(0, parseInt(setClipboard.value) || 0),
    globalShortcut: setShortcut.value.trim() || 'Ctrl+Shift+P',
    passwordLength: Math.max(8, Math.min(64, parseInt(setPwdLength.value) || 20)),
    startMinimized: setStartMin.checked,
  };
  await api.saveSettings(appSettings);
  showToast('Settings saved');
}

// ===== Navigation =====
function switchView(view: 'passwords' | 'activity' | 'settings') {
  currentView = view;
  viewPasswords.classList.toggle('hidden', view !== 'passwords');
  viewActivity.classList.toggle('hidden', view !== 'activity');
  viewSettings.classList.toggle('hidden', view !== 'settings');

  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.classList.toggle('active', (btn as HTMLElement).dataset.view === view);
  });

  if (view === 'activity') renderActivity();
  if (view === 'settings') populateSettings();
}

// ===== Password Generator =====
function generateRandomPassword(length = 20): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%^&*_+-=?';
  const all = upper + lower + digits + symbols;

  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  // Ensure at least one of each type
  const result: string[] = [];
  result.push(upper[array[0] % upper.length]);
  result.push(lower[array[1] % lower.length]);
  result.push(digits[array[2] % digits.length]);
  result.push(symbols[array[3] % symbols.length]);

  for (let i = 4; i < length; i++) {
    result.push(all[array[i] % all.length]);
  }

  // Shuffle using remaining random bytes
  for (let i = result.length - 1; i > 0; i--) {
    const j = array[i % array.length] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join('');
}

// ===== Event Listeners =====
unlockBtn.addEventListener('click', handleUnlock);
masterPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleUnlock();
});

lockBtn.addEventListener('click', handleLock);
addBtn.addEventListener('click', () => openModal());
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalSave.addEventListener('click', saveEntry);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

deleteCancel.addEventListener('click', () => {
  deleteOverlay.classList.add('hidden');
  deleteTargetId = null;
});

deleteConfirm.addEventListener('click', executeDelete);

deleteOverlay.addEventListener('click', (e) => {
  if (e.target === deleteOverlay) {
    deleteOverlay.classList.add('hidden');
    deleteTargetId = null;
  }
});

searchInput.addEventListener('input', () => {
  renderEntries(searchInput.value);
});

document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    switchView((btn as HTMLElement).dataset.view as 'passwords' | 'activity' | 'settings');
  });
});

toggleFormPassword.addEventListener('click', () => {
  formPassword.type = formPassword.type === 'password' ? 'text' : 'password';
});

generatePassword.addEventListener('click', () => {
  formPassword.value = generateRandomPassword(appSettings?.passwordLength ?? 20);
  formPassword.type = 'text';
});

settingsSaveBtn.addEventListener('click', handleSaveSettings);

// Keyboard shortcut: Escape to close modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modalOverlay.classList.contains('hidden')) closeModal();
    if (!deleteOverlay.classList.contains('hidden')) {
      deleteOverlay.classList.add('hidden');
      deleteTargetId = null;
    }
  }
});

// ===== Auto-lock listener =====
onAutoLocked(() => {
  entries = [];
  revealedIds.clear();
  editingId = null;
  app.classList.add('hidden');
  lockScreen.classList.remove('hidden');
  lockError.textContent = 'Vault auto-locked due to inactivity';
  searchInput.value = '';
  confirmPasswordInput.value = '';
  init();
});

// ===== Init =====
loadSettings().then(() => init());
