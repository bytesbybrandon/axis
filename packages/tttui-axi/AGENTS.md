# Project Context: Terminal TUI Tic-Tac-Toe

## Overview
A high-performance, cross-platform terminal (TUI) Tic-Tac-Toe game written in modern Node.js (ESM) with zero runtime dependencies. Designed for instant loading and responsive interactive play directly within the command prompt or terminal window.

## Architecture
- `bin/ttt.js`: Executable entry point with interactive game loop and signal cleanup.
- `src/game.js`: Pure game logic, board evaluation, winning line detection, move validation.
- `src/ai.js`: Minimax bot logic with Easy, Medium, and Unbeatable difficulties.
- `src/audio.js`: Zero-dependency native ANSI terminal bell audio cues with mute toggle.
- `src/axi.js`: Agent eXperience Interface (AXI) engine implementing the 10 AXI design principles with compact TOON serialization.
- `src/tui.js`: ANSI box-drawing, colorization, scoreboard rendering, cursor styling.
- `src/input.js`: Cross-platform raw keyboard input capture and event dispatching.
- `test/`: Automated test suites using Node's built-in `node:test` and `node:assert`.

## Development & Execution Commands
- **Interactive TUI**: `tttui` (or `node bin/ttt.js` / `npm start`)
- **Zero-Install Run**: `npx -y tttui-axi`
- **Agent AXI CLI**:
  - `tttui status` (compact TOON board status)
  - `tttui move <0-8>` (execute move)
  - `tttui ai [difficulty]` (trigger AI move)
  - `tttui reset` (reset board)
- **Global Link**: `npm link` (enables global `tttui`, `tttui-axi`, and `ttt` commands)
- **Run Tests**: `node --test` (or `npm test`)

## Conventions & Standards
- **Zero Dependencies**: Pure standard library only (`process.stdin`, `process.stdout`, `node:test`, `node:assert`).
- **Terminal Hygiene**: Always restore terminal cursor and exit raw mode upon termination (`q`, Ctrl+C, or process signals).
- **Separation of Concerns**: Game mechanics remain completely decoupled from TUI rendering and input listening, enabling 100% pure unit test coverage.
