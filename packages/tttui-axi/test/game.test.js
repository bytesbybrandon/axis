import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  makeMove,
  checkWinner,
  getAvailableMoves,
  resetRound,
  WINNING_COMBINATIONS
} from '../src/game.js';

describe('Game Logic Engine (src/game.js)', () => {
  it('initializes a fresh game state correctly', () => {
    const game = createGame('X');
    assert.equal(game.board.length, 9);
    assert(game.board.every(cell => cell === null));
    assert.equal(game.turn, 'X');
    assert.equal(game.winner, null);
    assert.equal(game.winningLine, null);
    assert.equal(game.isDraw, false);
    assert.equal(game.isOver, false);
    assert.deepEqual(game.scores, { X: 0, O: 0, ties: 0 });
  });

  it('allows valid moves and alternates turns', () => {
    let game = createGame('X');
    const res1 = makeMove(game, 4);
    assert.equal(res1.success, true);
    assert.equal(res1.game.board[4], 'X');
    assert.equal(res1.game.turn, 'O');

    const res2 = makeMove(res1.game, 0);
    assert.equal(res2.success, true);
    assert.equal(res2.game.board[0], 'O');
    assert.equal(res2.game.turn, 'X');
  });

  it('rejects moves on already occupied cells', () => {
    let game = createGame('X');
    game = makeMove(game, 4).game;
    const res = makeMove(game, 4);
    assert.equal(res.success, false);
    assert.equal(res.reason, 'Cell is already occupied');
  });

  it('rejects out of bounds moves', () => {
    const game = createGame('X');
    assert.equal(makeMove(game, -1).success, false);
    assert.equal(makeMove(game, 9).success, false);
  });

  it('detects wins for all 8 winning lines', () => {
    for (const combo of WINNING_COMBINATIONS) {
      const board = Array(9).fill(null);
      const [a, b, c] = combo;
      board[a] = 'X';
      board[b] = 'X';
      board[c] = 'X';

      const result = checkWinner(board);
      assert.equal(result.winner, 'X');
      assert.deepEqual(result.winningLine, combo);
      assert.equal(result.isDraw, false);
    }
  });

  it('detects a draw when board is full and no winner', () => {
    // X O X
    // X O O
    // O X X
    const board = [
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', 'X'
    ];
    const result = checkWinner(board);
    assert.equal(result.winner, null);
    assert.equal(result.winningLine, null);
    assert.equal(result.isDraw, true);
  });

  it('updates scores and flags isOver on victory', () => {
    let game = createGame('X');
    game = makeMove(game, 0).game; // X
    game = makeMove(game, 3).game; // O
    game = makeMove(game, 1).game; // X
    game = makeMove(game, 4).game; // O
    const winMove = makeMove(game, 2); // X completes row 0

    assert.equal(winMove.game.isOver, true);
    assert.equal(winMove.game.winner, 'X');
    assert.equal(winMove.game.scores.X, 1);
    assert.equal(winMove.game.scores.O, 0);

    // Moves after victory should be rejected
    const afterWin = makeMove(winMove.game, 8);
    assert.equal(afterWin.success, false);
    assert.equal(afterWin.reason, 'Game is already finished');
  });

  it('correctly reports available moves', () => {
    const board = ['X', null, 'O', null, 'X', null, null, null, 'O'];
    const moves = getAvailableMoves(board);
    assert.deepEqual(moves, [1, 3, 5, 6, 7]);
  });

  it('resets the board for next round while preserving scores', () => {
    let game = createGame('X');
    game.scores.X = 3;
    game.scores.O = 2;
    game.scores.ties = 1;
    game.board[0] = 'X';
    game.winner = 'X';
    game.isOver = true;

    const nextRound = resetRound(game, 'O');
    assert.equal(nextRound.turn, 'O');
    assert.equal(nextRound.winner, null);
    assert.equal(nextRound.isOver, false);
    assert(nextRound.board.every(cell => cell === null));
    assert.deepEqual(nextRound.scores, { X: 3, O: 2, ties: 1 });
  });
});
