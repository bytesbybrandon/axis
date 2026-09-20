# Spec 0001: Terminal TUI Tic-Tac-Toe

- **Status**: Implemented
- **Date**: 2026-09-20
- **Authors**: Antigravity & User
- **Scope Reference**: [docs/scope/tic-tac-toe.md](../scope/tic-tac-toe.md)

## 1. Overview & Objectives

Build a zero-dependency, high-performance, cross-platform terminal (TUI) Tic-Tac-Toe game in Node.js (ESM). The application is tailored for quick, responsive play in modern terminal emulators (such as Windows Terminal, PowerShell, CMD, macOS Terminal, Linux consoles) while waiting for long-running developer workflows or LLM prompts.

## 2. Architectural Design

The application follows a clean modular design with separated concerns:

```
ttt/
├── bin/
│   └── ttt.js             # Executable entry point with hashbang
├── src/
│   ├── game.js            # Pure game state, board model, win/tie calculation
│   ├── ai.js              # Minimax evaluation and difficulty heuristics
│   ├── tui.js             # ANSI formatting, box-drawing, layout rendering
│   └── input.js           # Raw keyboard capture and key mapping
├── test/
│   ├── game.test.js       # Unit tests for game logic & edge conditions
│   └── ai.test.js         # Unit tests for Minimax and AI decisions
├── package.json           # Node ESM project manifest (type: module)
└── docs/
    ├── scope/
    ├── specs/
    └── adr/
```

### 2.1 Module Responsibilities

1. **`src/game.js`**:
   - Pure, immutable or deterministically mutable board state: `Array(9)` filled with `'X'`, `'O'`, or `null`.
   - Functions: `createGame()`, `makeMove(game, index)`, `checkWinner(board)`, `getAvailableMoves(board)`, `resetRound(game)`.
   - Identifies the 8 winning lines: `[0,1,2]`, `[3,4,5]`, `[6,7,8]`, `[0,3,6]`, `[1,4,7]`, `[2,5,8]`, `[0,4,8]`, `[2,4,6]`.
   - Returns `{ winner: 'X' | 'O' | null, winningLine: number[] | null, isDraw: boolean }`.

2. **`src/ai.js`**:
   - `getBestMove(board, player, difficulty)`:
     - `unbeatable`: Minimax algorithm with alpha-beta pruning or full 3x3 depth (max 9! states, instantaneous).
     - `medium`: 60% optimal Minimax move, 40% random/heuristic move.
     - `easy`: Pure random valid move or basic block.

3. **`src/tui.js`**:
   - ANSI escape sequences for cursor repositioning, clearing, color accents:
     - Cyan for `'X'`
     - Amber/Yellow for `'O'`
     - Green for winning triplets
     - Inverted/highlighted styling for current cursor cell
   - Renders:
     - Title banner & Mode indicator
     - Scoreboard (`X Wins`, `O Wins`, `Ties`)
     - 3x3 box-drawn grid
     - Dynamic status prompt (e.g., `"Your turn (X)"`, `"AI thinking..."`, `"X wins! Press 'r' for next round"`)
     - Controls reference footer

4. **`src/input.js`**:
   - Puts `process.stdin` into raw mode (`setRawMode(true)`).
   - Maps keys:
     - Arrow keys (`Up`, `Down`, `Left`, `Right`) & `W`, `A`, `S`, `D` & `1`-`9` (direct cell selection)
     - `Enter` / `Space`: Confirm cell mark
     - `r` / `R`: Restart current round
     - `m` / `M`: Toggle mode (Single Player vs AI / Two Player Local)
     - `d` / `D`: Toggle difficulty (Easy / Medium / Unbeatable)
     - `q` / `Q` / `Ctrl+C`: Gracefully exit and teardown raw mode

5. **`bin/ttt.js` / CLI Driver**:
   - Orchestrates game loops, renders state transitions, manages AI turn delays (e.g. 200ms for natural feel), and registers process exit traps (`exit`, `SIGINT`, `SIGTERM`, uncaught exceptions) to guarantee cursor visibility and terminal cleanup.

## 3. Data Dictionary & Value Sources

| Value | Type | Source | Description |
|---|---|---|---|
| `board` | `(string \| null)[]` | `src/game.js` | 9-element array representing the 3x3 grid |
| `turn` | `'X' \| 'O'` | `src/game.js` | Current active player mark |
| `cursor` | `number` (0-8) | User input (`src/input.js`) | Selected grid index |
| `scores` | `{ X: number, O: number, ties: number }` | Session state | Persistent game scores |
| `mode` | `'pve' \| 'pvp'` | User toggle (`m`) | Current game mode |
| `difficulty` | `'easy' \| 'medium' \| 'unbeatable'` | User toggle (`d`) | AI intelligence level |
| `status` | `'playing' \| 'won' \| 'draw'` | `src/game.js` | Outcome state of current round |
| `winningLine`| `number[] \| null` | `src/game.js` | Indexes forming the 3-in-a-row |

## 4. Acceptance Criteria

- **AC1 [Board Rendering]**: Renders a crisp 3x3 grid using standard Unicode box-drawing characters (`┌ ┬ ┐ ├ ┼ ┤ └ ┴ ┘ │ ─`).
- **AC2 [Navigation]**: Cursor moves across the 9 cells using Arrow keys, WASD, or direct numeric keys (1-9), visibly highlighting the hovered cell.
- **AC3 [Move Placement]**: Pressing Enter or Space places the current player's mark into an empty cell; occupied cells reject moves cleanly without error.
- **AC4 [Mode Selection]**: Pressing `m` switches between Two-Player Local and vs AI modes.
- **AC5 [Difficulty Selection]**: In vs AI mode, pressing `d` toggles between Easy, Medium, and Unbeatable difficulties.
- **AC6 [Win & Draw Logic]**: Evaluates winning triplets across all 3 rows, 3 columns, and 2 diagonals; correctly flags a draw when all 9 cells are occupied with no winner.
- **AC7 [Visual Highlight]**: On victory, the 3 winning cells are highlighted with distinct vibrant styling (green).
- **AC8 [Score Tracking]**: Automatically increments and displays win counters for X, O, and Draws across multiple rounds.
- **AC9 [Instant Restart]**: Pressing `r` clears the board for a new round while preserving the scoreboard.
- **AC10 [Terminal Hygiene]**: Exiting via `q` or Ctrl+C safely cleans up raw mode and unhides the cursor, leaving the user's terminal in an intact state.

## 5. Build Plan

1. Initialize `package.json` with `"type": "module"`.
2. Implement `src/game.js` with pure game operations and win evaluation.
3. Implement `src/ai.js` with Minimax and difficulty weighting.
4. Implement `src/tui.js` with ANSI box rendering and colorization.
5. Implement `src/input.js` and `bin/ttt.js` for keyboard interaction and game loop.
6. Write test suites in `test/game.test.js` and `test/ai.test.js` using `node:test`.
7. Verify execution interactively and run automated test suites.
