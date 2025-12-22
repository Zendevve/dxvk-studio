<p align="center">
  <img src="public/icon.png" alt="DXVK Studio Icon" width="128" height="128">
</p>

<p align="center">
  <a href="https://github.com/facebook/react">
    <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React Badge">
  </a>
  <a href="https://www.electronjs.org/">
    <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron Badge">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript Badge">
  </a>
  <a href="https://tailwindcss.com/">
    <img src="https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS Badge">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License Badge">
  </a>
</p>

---

# DXVK Studio

**DXVK Studio** is a professional, open-source management suite for DXVK on Windows. It transforms the powerful DXVK translation layer from a command-line utility into a sleek, user-friendly desktop application, allowing you to easily install, manage, and configure Vulkan wrappers for your game library.

## Table of Contents
- [Features](#features)
- [Background Story](#background-story)
- [Getting Started](#getting-started)
- [What's Inside?](#whats-inside)
- [What's Next?](#whats-next)
- [Contributing](#contributing)
- [Resources](#resources)
- [License](#license)
- [Credits](#credits)

## Features
- **Smart Game Discovery**: Automatically scans Steam libraries (VDF parsing) to find installed games.
- **Architecture Detection**: Analyzes PE headers to automatically determine if a game is 32-bit or 64-bit, ensuring the correct DLLs are installed.
- **Engine Management**: Downloads and caches multiple versions of DXVK from GitHub/GitLab, supporting Official, GPL Async, and NVAPI forks.
- **Safe Deployment**: Automatically backs up original system DLLs (`d3d9.dll`, `dxgi.dll`) before installation and offers one-click restoration.
- **Configuration**: Visual editor for `dxvk.conf` to tweak performance settings without editing text files.
- **Monetization**: Open Core model—free source, optional paid binaries/support.

## Background Story
DXVK is an incredible tool that often revitalizes older games and improves performance on modern hardware by translating DirectX calls to Vulkan. However, manual installation is tedious: downloading archives, extracting specific DLLs, managing 32-bit vs 64-bit versions, and editing config files.

I built DXVK Studio to solve this "maintenance hell." I wanted a tool that felt native to Windows, respected user data (backups!), and made high-performance gaming accessible to everyone, not just power users comfortable with the command line.

## Getting Started

### Prerequisites
- Windows 10 or 11
- Vulkan-capable GPU drivers
- Node.js 18+ (for development)

### Installation
You can download the latest pre-built installer from the [Releases](https://github.com/Zendevve/dxvk-studio/releases) page.

### Running Locally
To build the project from source:

1. Clone the repository:
   ```bash
   git clone https://github.com/Zendevve/dxvk-studio.git
   cd dxvk-studio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## What's Inside?
A high-level overview of the project structure:

```text
dxvk-studio/
├── electron/                  # Main Process
│   ├── main.ts                # App entry point & window management
│   ├── preload.ts             # IPC Context Bridge (Security)
│   └── services/              # Core Logic
│       ├── deployer.ts        # DLL replacement & backup logic
│       ├── engine-manager.ts  # GitHub/GitLab API & Caching
│       ├── pe-analyzer.ts     # Binary analysis
│       └── steam-scanner.ts   # Game discovery
├── src/                       # Renderer Process (UI)
│   ├── components/            # React UI components
│   ├── App.tsx                # Main view controller
│   └── index.css              # Tailwind styling
├── docs/                      # Documentation
│   ├── ADR/                   # Architecture Decision Records
│   └── Features/              # Feature specifications
└── AGENTS.md                  # MCAF Rules (AI Context)
```

## What's Next?
- **Store Integrations**: Adding support for GOG Galaxy and Epic Games Store libraries.
- **Profiles**: Per-game configuration profiles that persist across updates.
- **Cloud Sync**: Syncing configurations between devices (Pro feature).

## Contributing
Contributions are welcome! This project follows the **MCAF** (Managed Code Coding AI Framework) standards.

1. Please read [AGENTS.md](AGENTS.md) to understand the strict rules and context preservation requirements.
2. Review the [Architecture Documentation](docs/HOME.md) before making structural changes.
3. Submit Pull Requests targeting the `main` branch.

## Resources
- [Electron](https://www.electronjs.org/) - Build cross-platform desktop apps with JavaScript, HTML, and CSS.
- [React](https://reactjs.org/) - A JavaScript library for building user interfaces.
- [TailwindCSS](https://tailwindcss.com/) - A utility-first CSS framework for rapid UI development.
- [Lucide](https://lucide.dev/) - Beautiful & consistent icon toolkit.
- [DXVK](https://github.com/doitsujin/dxvk) - Vulkan-based implementation of D3D9, D3D10 and D3D11 for Linux / Wine.

## License
This project is licensed under the [MIT License](LICENSE).
You are free to use, modify, and distribute the code, provided you include the original copyright notice.

## Footer

**Credits**
- **Author**: [Zendevve](https://github.com/Zendevve)
- **Reference**: [Main Branch](https://github.com/Zendevve/dxvk-studio)

---

<p align="center">
  <a href="https://github.com/Zendevve/dxvk-studio">
    <img src="public/icon.png" alt="DXVK Studio Icon" width="64" height="64">
  </a>
</p>
