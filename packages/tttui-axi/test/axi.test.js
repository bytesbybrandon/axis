import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  formatBoardToon,
  formatToon,
  formatHelpToon,
  handleAxiCommand,
  loadSession,
  saveSession
} from '../src/axi.js';
import { createGame, makeMove } from '../src/game.js';

describe('Agent eXperience Interface Suite (src/axi.js)', () => {
  const tmpSession = path.join(os.tmpdir(), `.test-session-${Date.now()}.json`);

  afterEach(() => {
    try {
      if (fs.existsSync(tmpSession)) fs.unlinkSync(tmpSession);
    } catch {
      // Ignore
    }
  });

  it('formats board into compact TOON string', () => {
    const board = [
      'X', null, 'O',
      null, 'X', null,
      null, null, 'O'
    ];
    const toonBoard = formatBoardToon(board);
    assert.equal(toonBoard, 'X . O / . X . / . . O');
  });

  it('formats active state into TOON format with contextual next actions', () => {
    const game = createGame('X');
    const toon = formatToon({
      game,
      mode: 'pve',
      difficulty: 'unbeatable',
      roundNumber: 1
    });

    assert(toon.includes('status:'));
    assert(toon.includes('board: ". . . / . . . / . . ."'));
    assert(toon.includes('turn: X'));
    assert(toon.includes('game_state: playing'));
    assert(toon.includes('available_moves: [0, 1, 2, 3, 4, 5, 6, 7, 8] (9 remaining)'));
    assert(toon.includes('scores: X:0 O:0 ties:0'));
    assert(toon.includes('next[3]:'));
    assert(toon.includes('Run `tttui move <0-8>` to place mark'));
    assert(toon.includes('Run `tttui ai` to trigger computer move'));
  });

  it('formats game over state with definitive empty state for available moves', () => {
    let game = createGame('X');
    game = makeMove(game, 0).game;
    game = makeMove(game, 3).game;
    game = makeMove(game, 1).game;
    game = makeMove(game, 4).game;
    game = makeMove(game, 2).game; // X wins row 0

    const toon = formatToon({
      game,
      mode: 'pve',
      difficulty: 'unbeatable',
      roundNumber: 1
    });

    assert(toon.includes('game_state: won (Player X)'));
    assert(toon.includes('winning_line: [0, 1, 2]'));
    assert(toon.includes('available_moves: 0 (game finished)'));
    assert(toon.includes('next[1]:'));
    assert(toon.includes('Run `tttui reset` to begin next round'));
  });

  it('handles help command', () => {
    const res = handleAxiCommand(['--help']);
    assert.equal(res.handled, true);
    assert.equal(res.exitCode, 0);
    assert(res.output.includes('usage:'));
    assert(res.output.includes('tttui move <0-8>'));
  });

  it('handles move command and rejects out of bounds move', () => {
    const res = handleAxiCommand(['move', '99']);
    assert.equal(res.handled, true);
    assert.equal(res.exitCode, 1);
    assert(res.output.includes('error: invalid cell index'));
  });

  it('handles unknown command with structured error', () => {
    const res = handleAxiCommand(['invalidcmd']);
    assert.equal(res.handled, true);
    assert.equal(res.exitCode, 1);
    assert(res.output.includes("error: unknown command 'invalidcmd'"));
  });

  it('saves and loads session state accurately', () => {
    const session = {
      game: createGame('O'),
      mode: 'pvp',
      difficulty: 'medium',
      roundNumber: 3
    };
    saveSession(session, tmpSession);
    const loaded = loadSession(tmpSession);

    assert.equal(loaded.mode, 'pvp');
    assert.equal(loaded.difficulty, 'medium');
    assert.equal(loaded.roundNumber, 3);
    assert.equal(loaded.game.turn, 'O');
  });
});
