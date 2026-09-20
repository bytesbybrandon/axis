# tttui-axi (Terminal TUI Tic-Tac-Toe & AXI)

A high-performance, cross-platform terminal (TUI) Tic-Tac-Toe game and **AXI (Agent eXperience Interface)** adhering to [axi.md](https://axi.md/). Written in modern Node.js (ESM) with zero runtime dependencies.

Designed for instant interactive play by humans while waiting for LLM tasks, and token-optimized programmatic control by AI agents.

![Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen) ![Node.js](https://img.shields.io/badge/Node.js-v18+-blue) ![Test](https://img.shields.io/badge/Tests-35%20Passing-success) ![AXI Compliant](https://img.shields.io/badge/AXI-Compliant-blueviolet)

---

## ⚡ Instant Run (Zero Install via NPX)

Run directly with zero manual installation:

```bash
npx -y tttui-axi
```

Or install/link globally:

```bash
npm link
# Then launch anytime:
tttui
# (Aliases: tttui-axi, ttt)
```

---

## 🤖 AXI: Agent eXperience Interface ([axi.md](https://axi.md/))

`tttui-axi` adheres to the **10 AXI design principles** for agent-ergonomic CLI design:

1. **Token-efficient output**: Compact TOON format saves ~40% tokens compared to raw JSON.
2. **Minimal default schemas**: Emits only actionable fields (`board`, `turn`, `game_state`, `available_moves`, `scores`).
3. **Content truncation & escape hatch**: Concise summary by default; use `--json` or `--full` for raw data.
4. **Pre-computed aggregates**: Eliminates round-trips by pre-calculating remaining available moves, winning triplets, and turn counters.
5. **Definitive empty states**: Reports `available_moves: 0 (game finished)` rather than ambiguous empty collections.
6. **Structured errors & exit codes**: Loud failures (exit code 1) on illegal moves or unknown flags; never hangs waiting for interactive input in AXI mode.
7. **Ambient context**: Full integration guide in `AGENTS.md` and `docs/specs/0003-tttui-axi.md`.
8. **Content first**: Running with no arguments in a terminal launches the interactive TUI; in non-TTY environments it displays live game state TOON.
9. **Contextual disclosure**: Every response concludes with a `next[N]:` block containing runnable follow-up suggestions.
10. **Consistent help**: Concise command reference via `tttui --help`.

### Agent Command Reference

```bash
# View board status in TOON format
tttui status

# Place a mark at grid cell 0-8
tttui move 4

# Trigger AI opponent move (easy, medium, unbeatable)
tttui ai unbeatable

# Reset board for next round
tttui reset

# Raw JSON escape hatch
tttui status --json
```

Sample AXI TOON output:

```yaml
status:
  action: Player placed mark at cell 4
  board: ". . . / . X . / . . ."
  turn: O
  mode: pve
  difficulty: unbeatable
  round: 1
  game_state: playing
  available_moves: [0, 1, 2, 3, 5, 6, 7, 8] (8 remaining)
  scores: X:0 O:0 ties:0
next[3]:
  Run `tttui move <0-8>` to place mark (choices: 0, 1, 2, 3, 5, 6, 7, 8)
  Run `tttui ai` to trigger computer move
  Run `tttui reset` to restart game
```

---

## 🎮 Interactive TUI Features (For Humans)

- **Zero Runtime Dependencies**: Standard Node.js library only.
- **Flicker-Free ANSI TUI**: Clean Unicode box-drawing (`┌─┬─┐`) with vibrant color accents.
- **Terminal Audio Effects**: Native ANSI bell acoustic cues for move placement, invalid moves, win fanfare, and ties—with an instant mute toggle (`V`).
- **Unbeatable Minimax AI**: Complete minimax game tree evaluation guaranteed to play optimally (or choose Easy / Medium).
- **Multiple Navigation Schemes**:
  - Arrow Keys (`↑`, `↓`, `←`, `→`)
  - WASD (`W`, `A`, `S`, `D`)
  - Vim Keys (`H`, `J`, `K`, `L`)
  - Direct Numeric Cell Jump (`1` through `9`)
- **Game Modes**:
  - Single Player vs AI (Easy, Medium, Unbeatable)
  - 2-Player Local (Pass & Play)
- **Scoreboard**: Tracks X wins, O wins, and Ties across rounds.

### Interactive Controls Reference

| Key(s) | Action |
|---|---|
| `↑` `↓` `←` `→` / `W` `A` `S` `D` / `H` `J` `K` `L` | Move cursor between grid cells |
| `1` - `9` | Direct quick-pick jump to grid cell |
| `Space` / `Enter` | Place mark in selected cell |
| `R` | Restart round (preserves score counters) |
| `M` | Toggle Mode (Player vs AI ↔ 2-Player Local) |
| `T` / `Tab` | Toggle AI Difficulty (Easy ↔ Medium ↔ Unbeatable) |
| `V` / `B` | Toggle Audio Effects (ON 🔊 ↔ OFF 🔇) |
| `Q` / `Ctrl+C` | Quit game cleanly |

---

## 🧪 Testing

Run the automated test suite powered by Node's built-in `node:test` runner:

```bash
npm test
# or
node --test
```

All 35 unit and integration tests across 6 test suites execute in ~130ms.

---

## 📐 Architecture & SDLC Artifacts

- **Spec 0003 (tttui-axi & axi.md)**: [docs/specs/0003-tttui-axi.md](./docs/specs/0003-tttui-axi.md)
- **Spec 0002 (Audio & Global CLI)**: [docs/specs/0002-terminal-audio-and-global-cli.md](./docs/specs/0002-terminal-audio-and-global-cli.md)
- **Spec 0001 (Core TUI)**: [docs/specs/0001-terminal-tui-tic-tac-toe.md](./docs/specs/0001-terminal-tui-tic-tac-toe.md)
- **ADR 0001 (Zero-Dep Node ESM)**: [docs/adr/0001-node-esm-zero-dep-tui.md](./docs/adr/0001-node-esm-zero-dep-tui.md)
- **Scope Charter**: [docs/scope/tic-tac-toe.md](./docs/scope/tic-tac-toe.md)
- **Project Context for Agents**: [AGENTS.md](./AGENTS.md)
