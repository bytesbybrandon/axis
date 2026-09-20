# Scope: Terminal TUI Tic-Tac-Toe

## Feature
Terminal TUI Tic-Tac-Toe Game

## Intent
Deliver an engaging, interactive terminal-based (TUI) Tic-Tac-Toe game that users can launch and play directly in the command line while waiting for long-running processes (like LLMs) to finish.

## Delivery Approach & Workflow Tier
- **Delivery Approach**: MVP (Smallest usable skateboard — complete interactive terminal TUI experience).
- **Workflow Tier**: GA (Full Lifecycle — includes design, audit, build, manual verification, automated unit/integration tests, code review, documentation, and context sync).

## Done When (Acceptance Seeds)
1. **Interactive TUI Grid**: Render an ANSI/box-drawing 3x3 grid with active cursor navigation (arrow keys or WASD or numeric keypad).
2. **Move Placement**: Allow marking cells (X and O) via Space or Enter on the highlighted cell, preventing overwriting occupied cells.
3. **Game Modes**:
   - Two-Player Local (pass-and-play).
   - Single Player vs AI (interactive bot opponent with Minimax / smart heuristics).
4. **State & Win Detection**: Accurately detect wins (rows, columns, diagonals) and ties/draws, highlighting the winning line.
5. **Session Scoreboard**: Track scores (X wins, O wins, Ties) across rounds within the session.
6. **Smooth Controls & Terminal Hygiene**: Instant restart (`r`), mode toggle (`m`), and exit (`q` or Ctrl+C) with guaranteed cleanup of terminal raw mode/alternate screen buffer.

## Ordered Milestones
1. Core game logic module (pure state transitions, win detection, valid move checks).
2. AI bot decision engine (Minimax algorithm for unbeatability / optional difficulty).
3. Terminal UI & Key Navigation system (raw mode input parsing, ANSI box drawing, clean terminal teardown).
4. Interactive Game loop & score tracking.
5. Automated test suite for game logic, AI, and edge conditions.
6. Verification, cross-model review, and documentation.

## Next Milestones: tttui-axi & axi.md Adherence
- **Package Identity**: Rebrand package to `tttui-axi` with `bin` mappings for `tttui` (primary), `tttui-axi`, and `ttt`.
- **axi.md Adherence (10 Principles)**:
  - Principle 1 & 2: Token-efficient TOON output with minimal default schema (board, turn, winner, scores).
  - Principle 3: Content truncation with `--json` / `--full` escape hatch.
  - Principle 4: Pre-computed aggregates (available moves, win lines, turn count).
  - Principle 5: Definitive empty states.
  - Principle 6: Structured errors, non-interactive execution on subcommands, fail loud on unknown flags.
  - Principle 8: Content first: running with no args in interactive TTY launches the full TUI; in non-TTY outputs current board TOON.
  - Principle 9: Contextual disclosure: outputs `next_action` suggestions after each move.
  - Principle 10: Consistent `--help` command reference.
- **Zero-Install Run**: Supports `npx -y tttui-axi` directly.

## Next Lifecycle Phase
`ACTIVE.ARCHITECT`
