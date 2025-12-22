# AGENTS.md

DXVK Studio — Electron + React + TypeScript + TailwindCSS

Follows [MCAF](https://mcaf.managed-code.com/)

---

## Conversations (Self-Learning)

Learn the user's habits, preferences, and working style. Extract rules from conversations, save to "## Rules to follow", and generate code according to the user's personal rules.

**Update requirement (core mechanism):**

Before doing ANY task, evaluate the latest user message.
If you detect a new rule, correction, preference, or change → update `AGENTS.md` first.
Only after updating the file you may produce the task output.
If no new rule is detected → do not update the file.

**When to extract rules:**

- prohibition words (never, don't, stop, avoid) or similar → add NEVER rule
- requirement words (always, must, make sure, should) or similar → add ALWAYS rule
- memory words (remember, keep in mind, note that) or similar → add rule
- process words (the process is, the workflow is, we do it like) or similar → add to workflow
- future words (from now on, going forward) or similar → add permanent rule

**Preferences → add to Preferences section:**

- positive (I like, I prefer, this is better) or similar → Likes
- negative (I don't like, I hate, this is bad) or similar → Dislikes
- comparison (prefer X over Y, use X instead of Y) or similar → preference rule

**Corrections → update or add rule:**

- error indication (this is wrong, incorrect, broken) or similar → fix and add rule
- repetition frustration (don't do this again, you ignored, you missed) or similar → emphatic rule
- manual fixes by user → extract what changed and why

**Strong signal (add IMMEDIATELY):**

- swearing, frustration, anger, sarcasm → critical rule
- ALL CAPS, excessive punctuation (!!!, ???) → high priority
- same mistake twice → permanent emphatic rule
- user undoes your changes → understand why, prevent

**Ignore (do NOT add):**

- temporary scope (only for now, just this time, for this task) or similar
- one-off exceptions
- context-specific instructions for current task only

**Rule format:**

- One instruction per bullet
- Tie to category (Testing, Code, Docs, etc.)
- Capture WHY, not just what
- Remove obsolete rules when superseded

---

## Rules to follow (Mandatory, no exceptions)

### Commands

- build: `npm run build`
- test: `npm run test` (when configured)
- dev: `npm run dev`
- format: `npx prettier --write .`
- lint: `npm run lint`

### Task Delivery (ALL TASKS)

- Read assignment, inspect code and docs before planning
- Write multi-step plan before implementation
- Implement code and tests together
- Run tests in layers: new → related suite → broader regressions
- After all tests pass: run format, then build
- Summarize changes and test results before marking complete
- Always run required builds and tests yourself; do not ask the user to execute them

### Documentation (ALL TASKS)

- All docs live in `docs/`
- Update feature docs when behaviour changes
- Update ADRs when architecture changes
- Templates: `docs/templates/ADR-Template.md`, `docs/templates/Feature-Template.md`

### Testing (ALL TASKS)

- Every behaviour change needs sufficient automated tests
- Each public API/IPC endpoint has at least one test
- Integration tests must exercise real flows end-to-end
- Prefer integration/API/UI tests over unit tests
- Never delete or weaken a test to make it pass
- Each test verifies a real flow or scenario

### Autonomy

- Start work immediately — no permission seeking
- Questions only for architecture blockers not covered by ADR
- Report only when task is complete

### Code Style

- TypeScript strict mode required
- No `any` types without justification
- No magic literals — extract to constants, enums, config
- All Electron IPC must go through `preload.ts` bridge
- Main process handles ALL file system operations
- Renderer is sandboxed - no direct Node.js access

### Critical (NEVER violate)

- Never commit secrets, keys, connection strings
- Never mock internal systems in integration tests
- Never skip tests to make PR green
- Never force push to main
- Never approve or merge (human decision)
- **NEVER implement Linux/Wine/Proton support until v2.0** (Windows is the ONLY priority for MVP)
- **NEVER auto-run DXVK on games with detected anti-cheat** without explicit user confirmation
- **ALWAYS backup original DLLs BEFORE any modification**
- **ALWAYS maintain context** - review past decisions and rules before acting

### Boundaries

**Always:**

- Read AGENTS.md and docs before editing code
- Run tests before commit
- Use Windows file paths (`\\` or `/`)
- **Preserve git history** - do not lose commits

**Ask first:**

- Changing public IPC API contracts
- Adding new npm dependencies
- Modifying type definitions in `shared/types.ts`
- Deleting code files

---

## Monetization Strategy (Open Core)
- **Community Edition**: Free, open source, build-from-source allowed.
- **Support**: Optional donations (GitHub Sponsors, Ko-fi).
- **Distribution**: Convenience binaries can be monetized, source remains open.

---

## Design System (Apple HIG-Derived)

> **Reference:** See `docs/Design-System.md` for full specification.

### Core Philosophy (ALL UI WORK)

| Principle | Meaning | Application |
|-----------|---------|-------------|
| **Clarity** | Immediately understandable | Legible text, precise icons, uncluttered layouts |
| **Deference** | Content takes priority | UI chrome recedes, contextual controls appear when needed |
| **Depth** | Visual hierarchy through layering | Shadows, blur, motion communicate structure |
| **Consistency** | Predictable patterns | Standard components, familiar navigation, platform conventions |

### Visual Rules (MANDATORY)

- **Typography:** Use system fonts (Inter/San Francisco pattern) with semantic text styles
- **Spacing:** 8-point grid system for all margins, padding, and sizing
- **Touch targets:** Minimum **44×44px** for all interactive elements
- **Contrast:** **4.5:1 minimum** for normal text, **3:1** for large text (WCAG AA)
- **Color semantics:** Red = destructive, Green = success, Blue = primary action, Yellow = warning

### Animation Rules

- **Purposeful only:** Animation must provide feedback, communicate state, or guide attention
- **Respect Reduced Motion:** Honor `prefers-reduced-motion` system preference
- **Spring physics:** Use easing curves that feel natural (ease-out for entrances, ease-in for exits)
- **Duration:** 150–300ms for micro-interactions, 300–500ms for transitions

### Component Standards

- **Buttons:** Always have visible labels (icon-only requires tooltip/aria-label)
- **Navigation:** Hierarchical for drill-down, tabs for peer sections
- **Modals:** Use sparingly; prefer inline expansion or slide-overs
- **Lists:** Provide clear visual separation, consistent row heights
- **Icons:** SF Symbols style (filled for active, outline for inactive)

### Accessibility (NEVER SKIP)

- All interactive elements must be keyboard navigable
- All images/icons must have alt text or aria-label
- Focus states must be visually obvious
- Color must NEVER be the sole indicator of state

---

## Preferences

### Likes

- Windows-first development focus
- Electron + React + TypeScript stack
- TailwindCSS for styling
- Clear separation between main/renderer processes
- Comprehensive error handling with user-friendly messages

### Dislikes

- Hardcoded values scattered through codebase
- Direct Node.js access in renderer
- Mocking internal systems
- Placeholder implementations
