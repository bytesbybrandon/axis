import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderView, formatMark, ANSI } from '../src/tui.js';
import { createGame } from '../src/game.js';

describe('TUI Rendering Suite (src/tui.js)', () => {
  it('formats cell marks with appropriate ANSI codes', () => {
    const emptyCell = formatMark(null, false, false);
    assert.equal(emptyCell, '   ');

    const cursorEmpty = formatMark(null, false, true);
    assert(cursorEmpty.includes('·'));

    const xMark = formatMark('X', false, false);
    assert(xMark.includes('X'));
    assert(xMark.includes(ANSI.brightCyan));

    const oMark = formatMark('O', false, false);
    assert(oMark.includes('O'));
    assert(oMark.includes(ANSI.brightYellow));

    const winningCell = formatMark('X', true, false);
    assert(winningCell.includes(ANSI.bgGreen));
  });

  it('renders a complete game view frame', () => {
    const game = createGame('X');
    const view = renderView({
      game,
      cursor: 4,
      mode: 'pve',
      difficulty: 'unbeatable',
      roundNumber: 1,
      statusMessage: null
    });

    assert(view.includes('TERMINAL TUI TIC-TAC-TOE'));
    assert(view.includes('UNBEATABLE'));
    assert(view.includes('Round:'));
    assert(view.includes('Sound:'));
    assert(view.includes('Player (X):'));
    assert(view.includes('AI (O):'));
    assert(view.includes('┌─────┬─────┬─────┐'));
    assert(view.includes('[Arrows/WASD]'));
    assert(view.includes('[T/Tab]'));
    assert(view.includes('[V]'));
  });

  it('displays custom status message when provided', () => {
    const game = createGame('X');
    const view = renderView({
      game,
      cursor: 4,
      mode: 'pvp',
      difficulty: 'medium',
      roundNumber: 2,
      statusMessage: 'Custom Notification Here'
    });

    assert(view.includes('Custom Notification Here'));
    assert(view.includes('2-PLAYER (PASS & PLAY)'));
  });
});
