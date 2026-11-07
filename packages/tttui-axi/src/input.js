/**
 * Raw Terminal Input Parser and Keybinding Dispatcher
 */

export function parseKey(str) {
  // Ctrl+C
  if (str === '\u0003') {
    return { name: 'exit', type: 'system' };
  }

  // Escape sequence navigation
  if (str === '\u001b[A') return { name: 'up', type: 'move' };
  if (str === '\u001b[B') return { name: 'down', type: 'move' };
  if (str === '\u001b[C') return { name: 'right', type: 'move' };
  if (str === '\u001b[D') return { name: 'left', type: 'move' };

  // Vim-style navigation
  if (str === 'k' || str === 'K') return { name: 'up', type: 'move' };
  if (str === 'j' || str === 'J') return { name: 'down', type: 'move' };
  if (str === 'h' || str === 'H') return { name: 'left', type: 'move' };
  if (str === 'l' || str === 'L') return { name: 'right', type: 'move' };

  // WASD navigation
  if (str === 'w' || str === 'W') return { name: 'up', type: 'move' };
  if (str === 's' || str === 'S') return { name: 'down', type: 'move' };
  if (str === 'a' || str === 'A') return { name: 'left', type: 'move' };
  if (str === 'd' || str === 'D') return { name: 'right', type: 'move' };

  // Actions
  if (str === '\r' || str === '\n' || str === ' ') {
    return { name: 'select', type: 'action' };
  }

  // Quick 1-9 direct jump & select
  if (/^[1-9]$/.test(str)) {
    return { name: 'cell', index: parseInt(str, 10) - 1, type: 'jump' };
  }

  // Hotkeys
  if (str === '\t') return { name: 'difficulty', type: 'command' };
  const lower = str.toLowerCase();
  if (lower === 'r') return { name: 'restart', type: 'command' };
  if (lower === 'm') return { name: 'mode', type: 'command' };
  if (lower === 't') return { name: 'difficulty', type: 'command' };
  if (lower === 'v' || lower === 'b') return { name: 'sound', type: 'command' };
  if (lower === 'q') return { name: 'exit', type: 'system' };

  return { name: 'unknown', raw: str };
}

/**
 * Attaches raw keyboard listener to stdin
 * @param {Function} onKey Callback receiving parsed key
 * @returns {Function} Cleanup function to detach and restore stdin
 */
export function setupRawInput(onKey) {
  const isRawSupported = Boolean(process.stdin.setRawMode);

  if (isRawSupported) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  const handler = (chunk) => {
    const key = parseKey(chunk);
    onKey(key);
  };

  process.stdin.on('data', handler);

  return function cleanup() {
    process.stdin.removeListener('data', handler);
    if (isRawSupported) {
      try {
        process.stdin.setRawMode(false);
      } catch {
        // Ignore if already reset
      }
    }
    process.stdin.pause();
  };
}
