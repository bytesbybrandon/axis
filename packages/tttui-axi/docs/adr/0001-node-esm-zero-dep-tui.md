# ADR 0001: Use Node.js ESM with Zero Dependencies for Terminal TUI

## Status
Accepted

## Context
We need to provide an interactive, responsive terminal-based (TUI) Tic-Tac-Toe game that users can run and play in their terminal while waiting for LLMs or other developer workflows.
The target environment includes Windows PowerShell, Windows Terminal, CMD, as well as Unix shells.

## Decision
We choose Node.js (v18+) with native ECMAScript Modules (ESM) and zero external dependencies:
1. Use standard Node `process.stdin` and `readline` for raw-mode keyboard capture.
2. Use standard ANSI escape sequences for TUI box-drawing and cursor positioning.
3. Use Node.js built-in test runner (`node:test` and `node:assert`) for unit and regression testing.

## Alternatives Considered
1. **Python with `curses` or `rich`**: While Python is available, Windows standard library `curses` support is inconsistent without external packages (`windows-curses`). Node.js provides first-class, built-in cross-platform raw mode on `process.stdin` on Windows and POSIX systems out of the box.
2. **Third-party TUI library (e.g. `blessed` or `ink`)**: Heavy dependency overhead and slower startup. Zero-dependency vanilla ANSI rendering achieves near-zero startup time (<50ms) and eliminates dependency maintenance or supply-chain concerns.

## Consequences
- **Positive**:
  - Instantaneous launch time.
  - Zero `npm install` needed to start playing.
  - Clean cross-platform terminal cleanup and raw-mode restoration.
  - Built-in `node:test` requires no test framework dependencies.
- **Negative**:
  - Custom keycode parsing and ANSI string layout must be maintained within the codebase rather than outsourced to a library.
