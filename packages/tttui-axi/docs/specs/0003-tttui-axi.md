# Spec 0003: tttui-axi & axi.md Adherence

- **Status**: Implemented
- **Date**: 2026-09-20
- **Authors**: Antigravity & User
- **Scope Reference**: [docs/scope/tic-tac-toe.md](../scope/tic-tac-toe.md)
- **Specification Reference**: [axi.md](https://axi.md/)

## 1. Overview & Objectives
Transform the application into an official AXI (Agent eXperience Interface) implementation:
1. Package identity: `tttui-axi` published on npm, supporting zero-install run via `npx -y tttui-axi`.
2. Binary identity: `tttui` as primary command, with `tttui-axi` and `ttt` aliases.
3. Dual-mode runtime:
   - **Interactive TUI Mode**: Default when run interactively in a terminal TTY with no arguments.
   - **Agent AXI Mode**: Activated when subcommands (`status`, `move`, `ai`, `reset`) or `--json`/`--toon` flags are passed, or when stdout is non-interactive. Adheres to all 10 AXI design principles.

## 2. The 10 AXI Principles Implementation

| # | Principle | Implementation in `tttui-axi` |
|---|---|---|
| 1 | **Token-efficient output** | Compact TOON format output by default saving ~40% tokens over verbose JSON. |
| 2 | **Minimal default schemas** | Only essential fields (`board`, `turn`, `status`, `winner`, `scores`). |
| 3 | **Content truncation & escape hatch** | Minimal summary by default; `--full` or `--json` escape hatch for complete raw state. |
| 4 | **Pre-computed aggregates** | Includes `available_moves` count/indices, `winning_line`, and turn count. |
| 5 | **Definitive empty states** | Explicit `moves_available: 0 (game finished)` rather than empty arrays. |
| 6 | **Structured errors & exit codes** | Clean error messages, exit code 1 on illegal move or unknown flag, no interactive prompt hanging in AXI mode. |
| 7 | **Ambient context** | Skill and CLAUDE/AGENTS instructions for agent discovery. |
| 8 | **Content first** | Running with no arguments shows live status (or TUI in interactive terminal), not generic help. |
| 9 | **Contextual disclosure** | Every output ends with a `next[N]:` block containing runnable next commands. |
| 10 | **Consistent help** | Fast, concise `--help` flag with command synopsis. |

## 3. Package Configuration

```json
{
  "name": "tttui-axi",
  "version": "1.0.0",
  "bin": {
    "tttui": "./bin/ttt.js",
    "tttui-axi": "./bin/ttt.js",
    "ttt": "./bin/ttt.js"
  }
}
```

## 4. State Persistence for AXI Subcommands
In AXI mode, state persists across invocations in a lightweight local file `.ttt-session.json` in the current working directory (or user cache), enabling agents to chain commands:
- `tttui move 4` -> sets X at center
- `tttui ai` -> AI responds
- `tttui status` -> inspects updated board

## 5. Acceptance Criteria
- **AC1 [Package Identity]**: `package.json` package name is `tttui-axi`, `bin` maps `tttui`, `tttui-axi`, and `ttt`.
- **AC2 [Zero-Install npx]**: Can be invoked via `npx -y tttui-axi` directly.
- **AC3 [Interactive Fallthrough]**: Running `tttui` in interactive TTY launches the full ANSI TUI.
- **AC4 [AXI Subcommands]**: Supports `status`, `move <0-8>`, `ai [difficulty]`, `reset`, and `help`.
- **AC5 [TOON Output & Contextual Disclosure]**: AXI commands output valid TOON format with `next[N]:` suggestions.
- **AC6 [JSON Escape Hatch]**: Passing `--json` or `--full` outputs raw machine-readable JSON.
- **AC7 [Error Handling]**: Unknown commands or invalid moves exit with code 1 and concise structured error.
