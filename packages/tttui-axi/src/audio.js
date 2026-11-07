/**
 * Terminal Audio Effects Module (Zero Dependency)
 * Emits native ANSI bell sequences (\x07) for tactile acoustic feedback.
 */

export const BELL = '\x07';

export const TONE_PATTERNS = {
  move: [0],
  invalid: [0, 90],
  win: [0, 120, 260],
  draw: [0, 200],
  toggle: [0]
};

/**
 * Returns tone delay offsets for a given sound type
 */
export function getTonePattern(type) {
  return TONE_PATTERNS[type] || [0];
}

/**
 * Triggers audio tone cues to terminal stdout
 * @param {'move'|'invalid'|'win'|'draw'|'toggle'} type Sound category
 * @param {boolean} enabled Sound toggle state
 * @param {object} stream Writable stream (defaults to process.stdout)
 * @returns {boolean} Whether tone was played
 */
export function playTone(type, enabled = true, stream = process.stdout) {
  if (!enabled) return false;

  const pattern = getTonePattern(type);
  for (const delay of pattern) {
    if (delay === 0) {
      stream.write(BELL);
    } else {
      setTimeout(() => {
        try {
          stream.write(BELL);
        } catch {
          // Stream closed or teardown in progress
        }
      }, delay);
    }
  }

  return true;
}
