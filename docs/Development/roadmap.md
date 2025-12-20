# DXVK Studio - Development Roadmap

## Project Vision
Build the **definitive open-source DXVK management suite** for Windows that:
- Obsoletes WoJ DXVK Manager by offering all "Premium" features for free
- Obsoletes PowerShell scripts by providing intelligent automation and polished UI
- Follows MCAF framework for sustainable development
- Applies Laws of UX for exceptional user experience

---

## Phase 1: Foundation & Architecture ✅

| Task | Status | Notes |
|------|--------|-------|
| Project scaffolding (Electron + Vite + React + TS) | ✅ Complete | |
| MCAF documentation structure | ✅ Complete | `docs/`, `AGENTS.md` |
| Core architecture design (ADR) | 🔲 Pending | |
| UI design system (Laws of UX) | ✅ Complete | `src/index.css` |
| Rebrand to "DXVK Studio" | ✅ Complete | |
| Push to Git | 🔲 Pending | |

---

## Phase 2: Core Engine

| Task | Status | Feature Doc |
|------|--------|-------------|
| PE Header Analysis (32/64-bit detection) | ✅ Complete | `docs/Features/pe-analysis.md` |
| DirectX version detection (D3D8/9/10/11) | ✅ Complete | (in pe-parser.ts) |
| DXVK variant management (Standard, Async, GPLAsync) | ✅ Complete | `docs/Features/dxvk-engine.md` |
| Symlink repository system | 🔲 Deferred | Post-MVP |
| dxvk.conf parser and generator | ✅ Complete | (config-parser.ts) |

---

## Phase 3: Game Library Integration

| Task | Status | Feature Doc |
|------|--------|-------------|
| Steam library scanner (`libraryfolders.vdf`) | ✅ Complete | `library-scanner.ts` |
| Epic Games Store integration | 🔲 Deferred | Post-MVP |
| GOG Galaxy integration | 🔲 Deferred | Post-MVP |
| Manual game directory support | ✅ Complete | Add Game Modal |

---

## Phase 4: Configuration GUI

| Task | Status | Feature Doc |
|------|--------|-------------|
| Visual dxvk.conf editor | 🔲 Pending | `docs/Features/config-editor.md` |
| Preset system (per-game community configs) | 🔲 Pending | `docs/Features/presets.md` |
| Real-time config preview (test window) | 🔲 Pending | `docs/Features/config-preview.md` |

---

## Phase 5: External Overlay System (Post-MVP)

| Task | Status | Feature Doc |
|------|--------|-------------|
| Transparent overlay window architecture | 🔲 Deferred | |
| Battery monitoring (XInput/HID) | 🔲 Deferred | |
| FPS/Performance metrics | 🔲 Deferred | |
| Stick sensitivity visualization | 🔲 Deferred | |

---

## Phase 6: Safety & Intelligence

| Task | Status | Feature Doc |
|------|--------|-------------|
| Anti-cheat database with warnings | 🔲 Pending | `docs/Features/anticheat-db.md` |
| WoJ configuration import tool | 🔲 Pending | `docs/Features/woj-import.md` |
| One-click presets for popular games | 🔲 Pending | `docs/Features/game-presets.md` |
| Cache management utilities | 🔲 Pending | `docs/Features/cache-mgmt.md` |

---

## Phase 7: Polish & Release

| Task | Status | Notes |
|------|--------|-------|
| UI/UX refinement per Laws of UX | 🔲 Pending | |
| Testing and verification | 🔲 Pending | |
| Documentation completion | 🔲 Pending | |
| Build and packaging | 🔲 Pending | |

---

## Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Runtime** | Electron 28+ | Cross-platform potential, native OS access |
| **Frontend** | React 18 + TypeScript | Component architecture, type safety |
| **Build** | Vite | Fast HMR, modern bundling |
| **Styling** | Vanilla CSS + CSS Variables | Laws of UX: flexibility, no framework bloat |
| **State** | Zustand | Lightweight, TypeScript-first |
| **IPC** | Electron IPC + contextBridge | Secure main/renderer communication |

---

## Definition of Done (Per Feature)

- [ ] Feature doc written with test flows
- [ ] Implementation complete
- [ ] Tests passing (unit + integration)
- [ ] Static analysis clean
- [ ] AGENTS.md updated if patterns discovered
- [ ] Reviewed and merged
