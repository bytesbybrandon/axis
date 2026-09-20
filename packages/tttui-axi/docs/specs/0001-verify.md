# Verification Plan: Terminal TUI Tic-Tac-Toe

Derived from Acceptance Criteria in [0001-terminal-tui-tic-tac-toe.md](./0001-terminal-tui-tic-tac-toe.md).

## Verification Checks

| Step | Action | Expected Behavior | AC Ref |
|---|---|---|---|
| **V1** | Launch `node bin/ttt.js` | TUI launches in alternate screen buffer with banner, 3x3 box grid, scoreboard, and footer. | AC1 |
| **V2** | Press Arrow keys / WASD | Cursor indicator moves between cells 0-8 with wrapped navigation. | AC2 |
| **V3** | Press Space / Enter on empty cell | Cell is marked with player symbol (`X` or `O`). Attempting move on occupied cell shows error status. | AC3 |
| **V4** | Press `m` | Toggles game mode between `vs AI` and `2-PLAYER (PASS & PLAY)`. | AC4 |
| **V5** | Press `d` (in vs AI mode) | Cycles difficulty through `EASY`, `MEDIUM`, and `UNBEATABLE`. | AC5 |
| **V6** | Play a complete winning line | Board identifies win, highlights 3 winning cells in bold green, increments winner's score. | AC6, AC7, AC8 |
| **V7** | Play a full board without winner | Board flags Draw/Tie, increments tie score. | AC6, AC8 |
| **V8** | Press `r` after round finishes | Board resets for next round; scoreboard remains preserved. | AC9 |
| **V9** | Press numeric keys `1`-`9` | Immediately jumps to and selects corresponding grid cell. | AC2, AC3 |
| **V10** | Press `q` or Ctrl+C | Application restores terminal cursor, exits alternate screen buffer, and restores raw mode. | AC10 |
