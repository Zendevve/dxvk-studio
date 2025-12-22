<div align="center">

<img src="public/icon.png" alt="DXVK Studio" width="100">

# DXVK Studio

A Windows desktop app that makes [DXVK](https://github.com/doitsujin/dxvk) easy for everyone.

[![Release](https://img.shields.io/github/v/release/Zendevve/dxvk-studio?style=flat-square&color=0969da)](https://github.com/Zendevve/dxvk-studio/releases)
[![Downloads](https://img.shields.io/github/downloads/Zendevve/dxvk-studio/total?style=flat-square&color=2da44e)](https://github.com/Zendevve/dxvk-studio/releases)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848f?style=flat-square&logo=electron&logoColor=white)](https://electronjs.org)

<br>

<img src="docs/screenshot.png" alt="DXVK Studio" width="700">

</div>

---

## What does it do?

DXVK is a translation layer that converts DirectX calls to Vulkan. It can **boost FPS in older games** and fix compatibility issues on modern systems. The problem? Installing it manually is tedious—downloading archives, picking the right DLLs, editing config files.

**DXVK Studio automates all of that.** Point it at your games, pick a version, click install. Done.

---

## Features

- **Auto-detects your games** from Steam, GOG Galaxy, and Epic Games Store
- **Handles 32-bit and 64-bit** automatically by reading executable headers
- **Multiple DXVK forks** — Official, GPL Async (shader stutter fix), and NVAPI
- **Safe installs** — backs up original DLLs before any changes
- **Visual config editor** — tweak HUD, VSync, FPS limits without touching files
- **Anti-cheat warnings** — alerts you before modifying online games
- **Activity logs** — see everything the app has done

---

## Quick Start

> **Open Core Model**: The source code is free and open. Pre-built binaries are available exclusively to supporters.

### Get DXVK Studio

| Option | What you get |
|--------|--------------|
| **🆓 Free** | [Build from source](#development) — full functionality, you compile it |
| **💎 Supporter** | [Buy on Gumroad](https://gumroad.com) — ready-to-run installer, supports development |

**Requirements:** Windows 10/11, Vulkan-capable GPU

**Usage:**
1. Launch the app — your games appear automatically
2. Click a game → choose fork and version → click **Install**
3. To undo, click **Uninstall** — original files are restored

---

## For Developers

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron 33 |
| UI | React 18 + TypeScript |
| Styling | TailwindCSS |
| Build | Vite + electron-builder |
| Testing | Vitest |

### Architecture

```
electron/
├── main.ts              # App entry, IPC handlers
├── preload.ts           # Context bridge (security)
└── services/
    ├── steam-scanner.ts # VDF parsing, registry queries
    ├── gog-scanner.ts   # GOG Galaxy registry integration
    ├── epic-scanner.ts  # Epic manifest parsing
    ├── pe-analyzer.ts   # PE header reading (32/64-bit detection)
    ├── engine-manager.ts# GitHub/GitLab API, download, cache
    ├── deployer.ts      # DLL installation, backup, restore
    └── anti-cheat.ts    # Signature detection

src/
├── App.tsx              # Main UI controller
├── components/          # Reusable React components
└── shared/types.ts      # Shared TypeScript interfaces
```

### Development

```bash
git clone https://github.com/Zendevve/dxvk-studio.git
cd dxvk-studio
npm install
npm run dev      # Start with hot reload
npm test         # Run tests
npm run build    # Production build
```

### Key Design Decisions

- **Windows-first**: Registry queries, PE parsing, native paths — built for Windows from day one
- **Offline-capable**: Downloaded engines are cached locally
- **Non-destructive**: Every install creates backups; uninstall always works
- **No admin required**: Operates entirely in user space

---

## Roadmap

| Status | Feature |
|--------|---------|
| ✅ | Multi-launcher game detection |
| ✅ | One-click DXVK install/uninstall |
| ✅ | Config editor with visual UI |
| ✅ | Anti-cheat detection |
| 🔜 | Per-game configuration profiles |
| 🔜 | HUD position/scale editor |
| 📋 | Profile import/export |
| 📋 | Linux support |

---

## Contributing

Pull requests welcome. For significant changes, open an issue first.

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## License

[MIT](LICENSE) — use it however you want.

---

<div align="center">

Made by [Zendevve](https://github.com/Zendevve)

</div>
