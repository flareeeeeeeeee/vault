# Vault

Secure desktop password manager. Stores passwords encrypted locally using AES-256-GCM with PBKDF2 key derivation.

![Vault Screenshot](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **AES-256-GCM encryption** with PBKDF2 (100k iterations, SHA-512)
- **Local storage only** — no cloud, no servers, your data stays on your machine
- **Auto-lock** after configurable inactivity timeout
- **Clipboard auto-clear** after copying passwords (configurable)
- **Global shortcut** (`Ctrl+Shift+P`) to show/hide from system tray
- **Activity log** — all actions are recorded and encrypted
- **Password generator** with configurable length
- **Search/filter** passwords in real time
- **Dark UI** with modern design

## Download

Go to [Releases](https://github.com/flareeeeeeeeee/vault/releases) and download the latest installer for your platform:

| Platform | File |
|----------|------|
| Windows (installer) | `Vault-Setup-x.x.x.exe` |
| Windows (portable) | `Vault-x.x.x.exe` |
| macOS | `Vault-x.x.x.dmg` |
| Linux | `Vault-x.x.x.AppImage` / `.deb` |

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/flareeeeeeeeee/vault.git
cd vault
npm install
npm start
```

### Build installers locally

```bash
npm run dist         # Current platform
npm run dist:win     # Windows
npm run dist:mac     # macOS
npm run dist:linux   # Linux
```

## How it works

1. On first launch, you create a **master password**
2. A key is derived using **PBKDF2** (SHA-512, 100k iterations) with a random salt
3. All passwords are stored in a single encrypted file (`vault.enc`) using **AES-256-GCM**
4. The activity log is stored in a separate encrypted file (`activity.log.enc`) using the same key
5. Settings are stored as plain JSON (`settings.json`) — no sensitive data
6. Files are written atomically (write to `.tmp`, then rename) to prevent corruption

### Security model

- Master key exists only in the main process memory, never sent to the renderer
- `contextIsolation: true`, `nodeIntegration: false`
- Strict CSP: `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'`
- All user data rendered with `textContent` (no `innerHTML`)
- Key buffer is zero-filled on lock
- External navigation and new windows are blocked

## Project structure

```
src/
├── main/
│   ├── main.ts              # Electron main process, IPC, tray, shortcuts
│   ├── preload.ts            # Context bridge
│   └── lib/
│       ├── crypto.ts         # AES-256-GCM + PBKDF2
│       ├── vault.ts          # Encrypted vault read/write
│       ├── logger.ts         # Encrypted activity log
│       └── settings.ts       # User preferences (plain JSON)
├── renderer/
│   ├── index.html            # UI
│   ├── styles.css            # Dark theme
│   └── app.ts                # Frontend logic
└── shared/
    └── types.ts              # Shared TypeScript interfaces
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Auto-lock timeout | 5 min | Lock vault after inactivity (0 = disabled) |
| Clipboard auto-clear | 10 sec | Clear clipboard after copy (0 = disabled) |
| Global shortcut | `Ctrl+Shift+P` | Toggle window visibility |
| Password length | 20 | Default generated password length |
| Start minimized | Off | Start hidden in system tray |

## License

MIT
