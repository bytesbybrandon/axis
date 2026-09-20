import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getBestMove } from '../src/ai.js';
import { createGame, makeMove } from '../src/game.js';

describe('AI Decision Engine (src/ai.js)', () => {
  it('easy mode returns an available cell', () => {
    const board = [
      'X', 'O', 'X',
      'X', 'O', null,
      'O', 'X', null
    ];
    const move = getBestMove(board, 'O', 'easy');
    assert(move === 5 || move === 8, `Expected move to be 5 or 8, got ${move}`);
  });

  it('medium mode takes immediate winning move', () => {
    // O can win at index 2
    const board = [
      'O', 'O', null,
      'X', 'X', null,
      null, null, null
    ];
    const move = getBestMove(board, 'O', 'medium');
    assert.equal(move, 2);
  });

  it('medium mode blocks immediate human win', () => {
    // X threatens to win at index 2
    const board = [
      'X', 'X', null,
      'O', null, null,
      null, null, null
    ];
    const move = getBestMove(board, 'O', 'medium');
    assert.equal(move, 2);
  });

  it('unbeatable mode takes immediate winning move', () => {
    const board = [
      'O', null, 'O',
      'X', 'X', null,
      null, null, null
    ];
    const move = getBestMove(board, 'O', 'unbeatable');
    assert.equal(move, 1);
  });

  it('unbeatable mode blocks immediate human win', () => {
    const board = [
      'X', null, 'X',
      'O', null, null,
      null, null, null
    ];
    const move = getBestMove(board, 'O', 'unbeatable');
    assert.equal(move, 1);
  });

  it('unbeatable mode blocks diagonal threats', () => {
    const board = [
      'X', null, null,
      null, 'O', null,
      null, null, 'X'
    ];
    // If X has [0, 8] and O is center [4], O should take an edge to prevent double fork
    const move = getBestMove(board, 'O', 'unbeatable');
    assert([1, 3, 5, 7].includes(move), `Expected edge move, got ${move}`);
  });

  it('two unbeatable AIs playing against each other always result in a draw', () => {
    let game = createGame('X');
    let moveCount = 0;

    while (!game.isOver && moveCount < 10) {
      const move = getBestMove(game.board, game.turn, 'unbeatable');
      assert.notEqual(move, null, 'Move should not be null during active game');
      const res = makeMove(game, move);
      assert.equal(res.success, true);
      game = res.game;
      moveCount++;
    }

    assert.equal(game.isDraw, true, 'Minimax self-play must end in draw');
    assert.equal(game.winner, null);
  });
});
