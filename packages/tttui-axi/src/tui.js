/**
 * Terminal UI (TUI) ANSI Box Drawing and Screen Renderer
 */

export const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background colors
  bgGreen: '\x1b[42m',
  bgCyan: '\x1b[46m',
  bgGray: '\x1b[100m',
  bgWhite: '\x1b[47m',

  // Terminal screen controls
  clearScreen: '\x1b[2J\x1b[H',
  cursorHome: '\x1b[H',
  clearLine: '\x1b[K',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  enterAltScreen: '\x1b[?1049h',
  exitAltScreen: '\x1b[?1049l'
};

/**
 * Format a player mark with color
 */
export function formatMark(mark, isWinningCell = false, isCursor = false) {
  if (isWinningCell) {
    return `${ANSI.bold}${ANSI.bgGreen}${ANSI.black} ${mark || ' '} ${ANSI.reset}`;
  }

  if (isCursor && !mark) {
    return `${ANSI.bold}${ANSI.inverse} · ${ANSI.reset}`;
  }

  if (!mark) {
    return '   ';
  }

  if (mark === 'X') {
    const style = isCursor ? `${ANSI.bold}${ANSI.brightCyan}${ANSI.inverse}` : `${ANSI.bold}${ANSI.brightCyan}`;
    return `${style} X ${ANSI.reset}`;
  } else {
    const style = isCursor ? `${ANSI.bold}${ANSI.brightYellow}${ANSI.inverse}` : `${ANSI.bold}${ANSI.brightYellow}`;
    return `${style} O ${ANSI.reset}`;
  }
}

/**
 * Renders the entire TUI view into an ANSI string
 */
export function renderView(state) {
  const {
    game,
    cursor,
    mode,
    difficulty,
    roundNumber,
    statusMessage,
    soundEnabled = true
  } = state;

  const lines = [];

  // Header Banner
  lines.push('');
  lines.push(`  ${ANSI.bold}${ANSI.cyan}┌─────────────────────────────────────────┐${ANSI.reset}`);
  lines.push(`  ${ANSI.bold}${ANSI.cyan}│        TERMINAL TUI TIC-TAC-TOE         │${ANSI.reset}`);
  lines.push(`  ${ANSI.bold}${ANSI.cyan}└─────────────────────────────────────────┘${ANSI.reset}`);
  lines.push('');

  // Mode, Round, and Sound Info
  const modeLabel = mode === 'pve'
    ? `vs AI (${difficulty.toUpperCase()})`
    : '2-PLAYER (PASS & PLAY)';
  
  const soundBadge = soundEnabled
    ? `${ANSI.brightGreen}ON 🔊${ANSI.reset}`
    : `${ANSI.dim}OFF 🔇${ANSI.reset}`;

  lines.push(`  ${ANSI.dim}Mode:${ANSI.reset} ${ANSI.bold}${ANSI.brightWhite}${modeLabel}${ANSI.reset}  ${ANSI.dim}│ Round:${ANSI.reset} ${ANSI.bold}${roundNumber}${ANSI.reset}  ${ANSI.dim}│ Sound:${ANSI.reset} ${soundBadge}`);
  lines.push('');

  // Scoreboard
  const xLabel = mode === 'pve' ? 'Player (X)' : 'Player X';
  const oLabel = mode === 'pve' ? 'AI (O)' : 'Player O';
  lines.push(
    `  ${ANSI.brightCyan}${xLabel}:${ANSI.reset} ${ANSI.bold}${game.scores.X}${ANSI.reset}    ` +
    `  ${ANSI.brightYellow}${oLabel}:${ANSI.reset} ${ANSI.bold}${game.scores.O}${ANSI.reset}    ` +
    `  ${ANSI.gray}Ties:${ANSI.reset} ${ANSI.bold}${game.scores.ties}${ANSI.reset}`
  );
  lines.push(`  ${ANSI.dim}─────────────────────────────────────────${ANSI.reset}`);
  lines.push('');

  // 3x3 Board Box Drawing
  const winningSet = new Set(game.winningLine || []);

  const cell = (idx) => formatMark(game.board[idx], winningSet.has(idx), cursor === idx);

  lines.push(`               ${ANSI.cyan}┌─────┬─────┬─────┐${ANSI.reset}`);
  lines.push(`               ${ANSI.cyan}│${ANSI.reset} ${cell(0)} ${ANSI.cyan}│${ANSI.reset} ${cell(1)} ${ANSI.cyan}│${ANSI.reset} ${cell(2)} ${ANSI.cyan}│${ANSI.reset}`);
  lines.push(`               ${ANSI.cyan}├─────┼─────┼─────┤${ANSI.reset}`);
  lines.push(`               ${ANSI.cyan}│${ANSI.reset} ${cell(3)} ${ANSI.cyan}│${ANSI.reset} ${cell(4)} ${ANSI.cyan}│${ANSI.reset} ${cell(5)} ${ANSI.cyan}│${ANSI.reset}`);
  lines.push(`               ${ANSI.cyan}├─────┼─────┼─────┤${ANSI.reset}`);
  lines.push(`               ${ANSI.cyan}│${ANSI.reset} ${cell(6)} ${ANSI.cyan}│${ANSI.reset} ${cell(7)} ${ANSI.cyan}│${ANSI.reset} ${cell(8)} ${ANSI.cyan}│${ANSI.reset}`);
  lines.push(`               ${ANSI.cyan}└─────┴─────┴─────┘${ANSI.reset}`);
  lines.push('');

  // Status Message
  let displayStatus = statusMessage;
  if (!displayStatus) {
    if (game.isOver) {
      if (game.winner) {
        const winnerName = (mode === 'pve' && game.winner === 'O') ? 'AI (O)' : `Player ${game.winner}`;
        displayStatus = `${ANSI.bold}${ANSI.brightGreen}★ ${winnerName} Wins! ★  Press [R] for Next Round.${ANSI.reset}`;
      } else if (game.isDraw) {
        displayStatus = `${ANSI.bold}${ANSI.yellow}It's a Draw! Press [R] for Next Round.${ANSI.reset}`;
      }
    } else {
      if (mode === 'pve' && game.turn === 'O') {
        displayStatus = `${ANSI.dim}AI is thinking...${ANSI.reset}`;
      } else {
        const playerTurnColor = game.turn === 'X' ? ANSI.brightCyan : ANSI.brightYellow;
        displayStatus = `Turn: ${ANSI.bold}${playerTurnColor}Player ${game.turn}${ANSI.reset}  (Navigate with arrows, Space/Enter to place)`;
      }
    }
  }

  lines.push(`  ${displayStatus}`);
  lines.push('');

  // Controls Keybindings Footer
  lines.push(`  ${ANSI.dim}─────────────────────────────────────────${ANSI.reset}`);
  lines.push(`  ${ANSI.dim}[Arrows/WASD]${ANSI.reset} Move    ${ANSI.dim}[Enter/Space]${ANSI.reset} Place    ${ANSI.dim}[1-9]${ANSI.reset} Quick Pick`);
  lines.push(`  ${ANSI.dim}[R]${ANSI.reset} Restart  ${ANSI.dim}[M]${ANSI.reset} Mode  ${ANSI.dim}[T/Tab]${ANSI.reset} Difficulty  ${ANSI.dim}[V]${ANSI.reset} Sound  ${ANSI.dim}[Q]${ANSI.reset} Exit`);
  lines.push('');

  return lines.join('\n');
}
