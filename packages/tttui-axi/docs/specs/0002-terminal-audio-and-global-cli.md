# Spec 0002: Terminal Audio Effects & Global CLI

- **Status**: Implemented
- **Date**: 2026-09-20
- **Authors**: Antigravity & User
- **Scope Reference**: [docs/scope/tic-tac-toe.md](../scope/tic-tac-toe.md)

## 1. Overview
Enhance Terminal TUI Tic-Tac-Toe with tactile acoustic cues using native ANSI terminal bell sequences (`\x07`) while maintaining strict zero runtime dependencies, and enable global execution via `npm link` so users can run `ttt` from anywhere.

## 2. Architectural Design

### 2.1 Audio Engine (`src/audio.js`)
- Zero dependencies: Uses `process.stdout.write('\x07')` to trigger terminal emulator acoustic alerts.
- Sound types:
  - `move`: Single crisp bell on valid player or AI mark.
  - `invalid`: Staccato double-beep on invalid move or occupied cell.
  - `win`: Ascending rhythmic triple chime (0ms, 120ms, 260ms).
  - `draw`: Two spaced contemplative chime cues (0ms, 200ms).
  - `toggle`: Immediate confirmation tone when sound is toggled ON.
- Non-blocking: Timed cues execute asynchronously via `setTimeout` to prevent UI freezing.

### 2.2 Controls & Presentation Updates
- **Keybinding**: `s` / `S` toggles sound ON ↔ OFF.
- **TUI Header Badge**: Displays current sound status (`Sound: ON [🔊]` vs `Sound: OFF [🔇]`).
- **Footer**: Includes `[S] Sound`.

### 2.3 Global CLI Execution
- Verified hashbang: `#!/usr/bin/env node` in `bin/ttt.js`.
- Package bin specification: `"bin": { "ttt": "./bin/ttt.js" }`.
- Execution: `npm link` links the package globally into Node's prefix, providing the `ttt` CLI command.

## 3. Acceptance Criteria
- **AC1 [Audio Engine]**: `src/audio.js` exports pure `playTone(type, enabled)` function handling all specified sound types.
- **AC2 [Mute Toggle]**: Pressing `s` or `S` toggles sound state and persists throughout the session.
- **AC3 [Mute State Guarantee]**: When sound is OFF, zero bell characters are written to `stdout`.
- **AC4 [TUI Status Display]**: Sound state is visibly indicated in the TUI header and footer.
- **AC5 [Global Binary]**: `ttt` command is available system-wide after `npm link`.

## 4. ADR Consideration
ADR not required as this extends existing zero-dependency Node ESM architecture established in ADR 0001.
