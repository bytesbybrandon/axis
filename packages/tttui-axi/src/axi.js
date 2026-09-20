/**
 * Agent eXperience Interface (AXI) Engine
 * Implements the 10 AXI design principles from https://axi.md/
 */
import fs from 'node:fs';
import path from 'node:path';
import { createGame, makeMove, resetRound, getAvailableMoves, checkWinner } from './game.js';
import { getBestMove } from './ai.js';

const SESSION_FILENAME = '.ttt-session.json';

/**
 * Loads or initializes the persisted game session
 */
export function loadSession(sessionPath = path.resolve(process.cwd(), SESSION_FILENAME)) {
  try {
    if (fs.existsSync(sessionPath)) {
      const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      if (data && data.game && Array.isArray(data.game.board)) {
        return data;
      }
    }
  } catch {
    // Fallback to fresh session on read failure
  }

  return {
    game: createGame('X'),
    mode: 'pve',
    difficulty: 'unbeatable',
    roundNumber: 1
  };
}

/**
 * Persists the game session to disk
 */
export function saveSession(session, sessionPath = path.resolve(process.cwd(), SESSION_FILENAME)) {
  try {
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf8');
  } catch {
    // If working directory is non-writable, ignore silently
  }
}

/**
 * Formats a 9-element board into compact single-line or 3-row TOON format
 */
export function formatBoardToon(board) {
  const row0 = board.slice(0, 3).map(c => c || '.').join(' ');
  const row1 = board.slice(3, 6).map(c => c || '.').join(' ');
  const row2 = board.slice(6, 9).map(c => c || '.').join(' ');
  return `${row0} / ${row1} / ${row2}`;
}

/**
 * Serializes state into token-efficient TOON format (Principle 1, 2, 4, 5, 9)
 */
export function formatToon(state, actionNote = null) {
  const { game, mode, difficulty, roundNumber } = state;
  const available = getAvailableMoves(game.board);
  const lines = [];

  lines.push('status:');
  if (actionNote) {
    lines.push(`  action: ${actionNote}`);
  }
  lines.push(`  board: "${formatBoardToon(game.board)}"`);
  lines.push(`  turn: ${game.turn}`);
  lines.push(`  mode: ${mode}`);
  lines.push(`  difficulty: ${difficulty}`);
  lines.push(`  round: ${roundNumber}`);

  if (game.isOver) {
    if (game.winner) {
      lines.push(`  game_state: won (Player ${game.winner})`);
      lines.push(`  winning_line: [${game.winningLine.join(', ')}]`);
    } else {
      lines.push('  game_state: draw');
    }
    lines.push('  available_moves: 0 (game finished)');
  } else {
    lines.push('  game_state: playing');
    lines.push(`  available_moves: [${available.join(', ')}] (${available.length} remaining)`);
  }

  lines.push(`  scores: X:${game.scores.X} O:${game.scores.O} ties:${game.scores.ties}`);

  // Contextual disclosure (Principle 9)
  const nextActions = [];
  if (game.isOver) {
    nextActions.push('Run `tttui reset` to begin next round');
  } else {
    if (available.length > 0) {
      nextActions.push(`Run \`tttui move <0-8>\` to place mark (choices: ${available.join(', ')})`);
    }
    if (mode === 'pve') {
      nextActions.push('Run `tttui ai` to trigger computer move');
    }
    nextActions.push('Run `tttui reset` to restart game');
  }

  lines.push(`next[${nextActions.length}]:`);
  for (const act of nextActions) {
    lines.push(`  ${act}`);
  }

  return lines.join('\n');
}

/**
 * Returns concise help reference (Principle 10)
 */
export function formatHelpToon() {
  return `tttui-axi - Agent eXperience Interface for Terminal Tic-Tac-Toe (axi.md)

usage:
  tttui                       Interactive TUI (default in terminal)
  tttui status                Show current game state (compact TOON)
  tttui move <0-8>            Place mark at cell index (0-8)
  tttui ai [difficulty]       Execute AI move (easy, medium, unbeatable)
  tttui reset                 Reset current board for new round
  tttui --json                Escape hatch: output full state in JSON
  tttui --help                Show this command reference

grid layout:
  0 1 2
  3 4 5
  6 7 8
`;
}

/**
 * Executes AXI command line invocation
 * @param {string[]} args Process arguments (slice of argv)
 * @returns {{ handled: boolean, output?: string, exitCode?: number }}
 */
export function handleAxiCommand(args = process.argv.slice(2)) {
  // If no args and stdout is TTY, return handled: false to boot interactive TUI
  const isTty = process.stdout.isTTY && !process.env.CI;
  if (args.length === 0) {
    if (isTty) {
      return { handled: false };
    }
    // Non-interactive without args: content-first live status (Principle 8)
    const session = loadSession();
    return { handled: true, output: formatToon(session), exitCode: 0 };
  }

  const isJson = args.includes('--json') || args.includes('--full');
  const cleanArgs = args.filter(a => a !== '--json' && a !== '--full' && a !== '--toon');
  const command = cleanArgs[0] ? cleanArgs[0].toLowerCase() : 'status';

  if (command === 'help' || command === '--help' || command === '-h') {
    return { handled: true, output: formatHelpToon(), exitCode: 0 };
  }

  const session = loadSession();

  switch (command) {
    case 'status': {
      if (isJson) {
        return { handled: true, output: JSON.stringify(session, null, 2), exitCode: 0 };
      }
      return { handled: true, output: formatToon(session), exitCode: 0 };
    }

    case 'move': {
      const idxStr = cleanArgs[1];
      if (idxStr === undefined) {
        return {
          handled: true,
          output: 'error: missing cell index. Usage: tttui move <0-8>',
          exitCode: 1
        };
      }

      const idx = parseInt(idxStr, 10);
      if (isNaN(idx) || idx < 0 || idx > 8) {
        return {
          handled: true,
          output: `error: invalid cell index '${idxStr}'. Expected integer 0-8.`,
          exitCode: 1
        };
      }

      const res = makeMove(session.game, idx);
      if (!res.success) {
        return {
          handled: true,
          output: `error: move rejected - ${res.reason}`,
          exitCode: 1
        };
      }

      session.game = res.game;
      saveSession(session);

      if (isJson) {
        return { handled: true, output: JSON.stringify(session, null, 2), exitCode: 0 };
      }
      return {
        handled: true,
        output: formatToon(session, `Player placed mark at cell ${idx}`),
        exitCode: 0
      };
    }

    case 'ai': {
      if (session.game.isOver) {
        return {
          handled: true,
          output: 'error: game is already finished. Run `tttui reset` first.',
          exitCode: 1
        };
      }

      const diff = cleanArgs[1] || session.difficulty || 'unbeatable';
      const aiMove = getBestMove(session.game.board, session.game.turn, diff);

      if (aiMove === null) {
        return {
          handled: true,
          output: 'error: no available moves for AI.',
          exitCode: 1
        };
      }

      const res = makeMove(session.game, aiMove);
      session.game = res.game;
      saveSession(session);

      if (isJson) {
        return { handled: true, output: JSON.stringify(session, null, 2), exitCode: 0 };
      }
      return {
        handled: true,
        output: formatToon(session, `AI (${diff}) placed mark at cell ${aiMove}`),
        exitCode: 0
      };
    }

    case 'reset': {
      session.roundNumber += 1;
      session.game = resetRound(session.game, 'X');
      saveSession(session);

      if (isJson) {
        return { handled: true, output: JSON.stringify(session, null, 2), exitCode: 0 };
      }
      return {
        handled: true,
        output: formatToon(session, `Board reset for round ${session.roundNumber}`),
        exitCode: 0
      };
    }

    default: {
      return {
        handled: true,
        output: `error: unknown command '${command}'. Run \`tttui --help\` for available commands.`,
        exitCode: 1
      };
    }
  }
}
