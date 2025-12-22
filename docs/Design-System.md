# Design System

> Apple Human Interface Guidelines (HIG) adapted for DXVK Studio

---

## Core Principles

### 1. Clarity

Every element must be immediately understandable.

| Element | Requirement |
|---------|-------------|
| **Text** | Legible at all sizes, semantic hierarchy (title → body → caption) |
| **Icons** | Instantly recognizable, consistent style, no obscure metaphors |
| **Layout** | Uncluttered, focused, purposeful whitespace |

**Implementation:**
- Use Inter or system sans-serif fonts
- Limit UI text to essential information only
- One primary action per screen/context

### 2. Deference

Content is the hero; UI chrome recedes.

- Navigation and controls should not compete with content for attention
- Use translucent/blur materials to create depth without visual weight
- Show contextual controls only when relevant (hover states, selection modes)

### 3. Depth

Visual layering communicates hierarchy and relationships.

| Technique | Purpose |
|-----------|---------|
| **Shadows** | Elevation, floating elements |
| **Blur** | Background separation, focus |
| **Motion** | Transition between states, spatial relationships |

### 4. Consistency

Users leverage existing platform knowledge.

- Use standard UI patterns (hierarchical nav, tab bars, modals)
- Maintain consistent interaction behaviors across the app
- Follow platform conventions (Windows: title bar, menus, keyboard shortcuts)

---

## Visual Foundations

### Color Palette

```
/* Semantic Colors */
--color-primary:     #3B82F6;  /* Blue - primary actions */
--color-success:     #22C55E;  /* Green - confirmations */
--color-warning:     #F59E0B;  /* Amber - cautions */
--color-destructive: #EF4444;  /* Red - deletions, errors */

/* Neutral Scale */
--color-bg-primary:   #0A0A0A;  /* Main background */
--color-bg-secondary: #141414;  /* Cards, panels */
--color-bg-tertiary:  #1F1F1F;  /* Elevated surfaces */
--color-border:       #2A2A2A;  /* Subtle borders */
--color-text-primary: #FAFAFA;  /* Primary text */
--color-text-secondary: #A1A1AA; /* Secondary text */
--color-text-muted:   #71717A;  /* Disabled, hints */
```

### Typography

| Style | Size | Weight | Line Height | Use Case |
|-------|------|--------|-------------|----------|
| **Large Title** | 28px | 700 | 1.2 | Page headers |
| **Title 1** | 22px | 600 | 1.3 | Section headers |
| **Title 2** | 18px | 600 | 1.3 | Card titles |
| **Headline** | 16px | 600 | 1.4 | Emphasized text |
| **Body** | 14px | 400 | 1.5 | Default text |
| **Caption** | 12px | 400 | 1.4 | Secondary info |
| **Footnote** | 11px | 400 | 1.3 | Metadata, timestamps |

**Rules:**
- Support Dynamic Type via relative units (`rem`)
- Never hardcode font sizes in px for user-facing text
- Maintain 4.5:1 contrast ratio minimum

### Spacing (8pt Grid)

```
--space-1:  4px;   /* Tight spacing */
--space-2:  8px;   /* Default gap */
--space-3:  12px;  /* Component padding */
--space-4:  16px;  /* Section spacing */
--space-5:  24px;  /* Large gaps */
--space-6:  32px;  /* Page margins */
--space-8:  48px;  /* Major sections */
```

### Border Radius

```
--radius-sm:   4px;   /* Small elements (badges) */
--radius-md:   8px;   /* Default (buttons, inputs) */
--radius-lg:   12px;  /* Cards, panels */
--radius-xl:   16px;  /* Modals, large cards */
--radius-full: 9999px; /* Pills, avatars */
```

### Shadows & Elevation

```
/* Elevation levels */
--shadow-sm:  0 1px 2px rgba(0,0,0,0.3);
--shadow-md:  0 4px 6px rgba(0,0,0,0.3);
--shadow-lg:  0 10px 15px rgba(0,0,0,0.4);
--shadow-xl:  0 20px 25px rgba(0,0,0,0.5);

/* Glass effect */
--glass-bg:   rgba(255,255,255,0.05);
--glass-blur: blur(20px);
--glass-border: 1px solid rgba(255,255,255,0.1);
```

---

## Interaction Patterns

### Touch/Click Targets

| Context | Minimum Size |
|---------|--------------|
| **Primary buttons** | 44×44px |
| **Icon buttons** | 44×44px (icon can be smaller, hit area must not) |
| **List items** | 44px height minimum |
| **Inline links** | 24px height minimum |

### States

Every interactive element needs these states:

| State | Visual Treatment |
|-------|------------------|
| **Default** | Base appearance |
| **Hover** | Subtle background change, cursor pointer |
| **Focus** | Visible ring (2px solid primary color) |
| **Active/Pressed** | Slightly darker, scale(0.98) |
| **Disabled** | 50% opacity, cursor not-allowed |
| **Loading** | Spinner or skeleton, disabled interaction |

### Animation

```css
/* Timing */
--duration-instant: 100ms;
--duration-fast:    150ms;
--duration-normal:  250ms;
--duration-slow:    400ms;

/* Easing */
--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);     /* Entrances */
--ease-in:     cubic-bezier(0.7, 0, 0.84, 0);     /* Exits */
--ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);    /* State changes */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy feedback */
```

**Rules:**
- Entrances: ease-out (fast start, slow finish)
- Exits: ease-in (slow start, fast finish)
- Always respect `prefers-reduced-motion: reduce`

---

## Component Specifications

### Buttons

| Type | Use Case | Visual |
|------|----------|--------|
| **Primary** | Main action per context | Solid fill, primary color |
| **Secondary** | Alternative actions | Border only, transparent fill |
| **Ghost** | Tertiary/inline actions | No border, transparent fill |
| **Destructive** | Delete, remove, cancel | Red color, requires confirmation |

**Requirements:**
- Label must be a verb or verb phrase
- Minimum width: 80px for standalone buttons
- Icon + label preferred over icon-only

### Navigation

| Pattern | When to Use |
|---------|-------------|
| **Sidebar (hierarchical)** | Deep app structure, 3+ levels |
| **Tab bar** | 3–5 top-level sections |
| **Back button** | Drill-down flows, modal dismissal |
| **Breadcrumbs** | Deep hierarchies where context matters |

### Modals & Overlays

- Use for actions requiring **focused attention** or **confirmation**
- Always provide a clear dismiss action (X button, Cancel, or click-outside)
- Limit to **one primary action** per modal
- Prefer slide-over panels for contextual editing

### Lists & Tables

- Consistent row height (min 44px)
- Clear visual separation (borders or alternating backgrounds)
- Sortable columns indicated with icons
- Empty states must have helpful messaging

---

## Accessibility Checklist

### Required (WCAG AA)

- [ ] All text has 4.5:1 contrast ratio (3:1 for large text)
- [ ] Focus indicators are visible on all interactive elements
- [ ] All functionality available via keyboard
- [ ] Color is not the only indicator of state (add icons/text)
- [ ] All images have alt text
- [ ] Form inputs have associated labels
- [ ] Error messages are descriptive and actionable

### Recommended

- [ ] Support `prefers-reduced-motion`
- [ ] Support `prefers-contrast: more`
- [ ] Provide skip-to-content link
- [ ] Use semantic HTML elements
- [ ] Group related form fields with fieldset/legend

---

## Platform Considerations (Windows)

DXVK Studio runs on Windows, so we adapt HIG principles to Windows conventions:

| Apple HIG | Windows Equivalent |
|-----------|-------------------|
| Navigation bar | Title bar with menu |
| Tab bar | Sidebar navigation or tabs |
| Sheet/Action sheet | Modal dialog or command bar |
| SF Symbols | Fluent UI icons or custom SVG |

**Windows-specific:**
- Support native title bar controls (minimize, maximize, close)
- Support high-contrast themes
- Honor Windows accent colors where appropriate
- Keyboard shortcuts should follow Windows conventions (Ctrl+, not Cmd+)

---

## Quick Reference

### Do

✓ Use semantic colors consistently
✓ Animate with purpose
✓ Make touch targets at least 44px
✓ Provide visible focus states
✓ Support keyboard navigation
✓ Use the 8pt spacing system

### Don't

✗ Use color as the only state indicator
✗ Add decorative animations
✗ Make targets smaller than 44px
✗ Skip focus states
✗ Require mouse for all interactions
✗ Use arbitrary spacing values
