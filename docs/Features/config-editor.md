# Feature: DXVK Configuration Editor

Status: In Progress
Owner: UI
Created: 2025-12-21

---

## Purpose

Provide a visual interface for editing dxvk.conf files without requiring users to manually edit text. Reduces barrier to entry and prevents configuration errors.

---

## Scope

### In scope

- Visual controls for all common DXVK options
- Categorized settings (Performance, Memory, HUD, Display)
- Save/load configurations per game
- Preset system (Performance, Quality, Balanced)
- HUD element toggle checkboxes

### Out of scope

- Real-time preview in running game (deferred)
- Cloud sync of presets

---

## UI Components

### ConfigEditor
Main container with tabs for each category:
- **General**: Frame rate, async shader compilation
- **HUD**: FPS, frametimes, memory, device info toggles
- **Memory**: Max device memory, cache settings
- **Display**: HDR, tear-free, VSync settings
- **Advanced**: Device spoofing, debug options

### ConfigPreview
Live preview of generated dxvk.conf content

---

## Verification

| ID | Description | Expected Result |
|----|-------------|-----------------|
| POS-001 | Toggle FPS HUD | dxvk.hud includes "fps" |
| POS-002 | Set frame rate limit | dxgi.maxFrameRate = value |
| POS-003 | Save config | dxvk.conf written to game folder |
| POS-004 | Load preset | All fields update to preset values |

---

## Definition of Done

- [ ] ConfigEditor component implemented
- [ ] All common options have visual controls
- [ ] Presets working (Performance, Quality, Balanced)
- [ ] Save/Load functionality
