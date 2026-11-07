/**
 * Core Tic-Tac-Toe Game Engine (Pure Logic)
 */

export const WINNING_COMBINATIONS = [
  [0, 1, 2], // Row 0
  [3, 4, 5], // Row 1
  [6, 7, 8], // Row 2
  [0, 3, 6], // Col 0
  [1, 4, 7], // Col 1
  [2, 5, 8], // Col 2
  [0, 4, 8], // Diag \
  [2, 4, 6]  // Diag /
];

/**
 * Creates a fresh game instance
 */
export function createGame(startingPlayer = 'X') {
  return {
    board: Array(9).fill(null),
    turn: startingPlayer,
    winner: null,
    winningLine: null,
    isDraw: false,
    isOver: false,
    scores: {
      X: 0,
      O: 0,
      ties: 0
    }
  };
}

/**
 * Returns available move indices (0-8)
 */
export function getAvailableMoves(board) {
  const moves = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      moves.push(i);
    }
  }
  return moves;
}

/**
 * Evaluates the board for a win or tie condition
 */
export function checkWinner(board) {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return {
        winner: board[a],
        winningLine: combo,
        isDraw: false
      };
    }
  }

  const isFull = board.every(cell => cell !== null);
  return {
    winner: null,
    winningLine: null,
    isDraw: isFull
  };
}

/**
 * Executes a move on the game state
 * Returns a new updated game state object
 */
export function makeMove(game, index) {
  if (game.isOver) {
    return { success: false, reason: 'Game is already finished', game };
  }

  if (index < 0 || index > 8) {
    return { success: false, reason: 'Index out of bounds', game };
  }

  if (game.board[index] !== null) {
    return { success: false, reason: 'Cell is already occupied', game };
  }

  const newBoard = [...game.board];
  newBoard[index] = game.turn;

  const result = checkWinner(newBoard);
  const newScores = { ...game.scores };

  let isOver = false;
  if (result.winner) {
    newScores[result.winner] += 1;
    isOver = true;
  } else if (result.isDraw) {
    newScores.ties += 1;
    isOver = true;
  }

  const nextTurn = game.turn === 'X' ? 'O' : 'X';

  const updatedGame = {
    ...game,
    board: newBoard,
    turn: nextTurn,
    winner: result.winner,
    winningLine: result.winningLine,
    isDraw: result.isDraw,
    isOver,
    scores: newScores
  };

  return { success: true, game: updatedGame };
}

/**
 * Resets the board for the next round while preserving scores
 */
export function resetRound(game, startingPlayer = 'X') {
  return {
    ...game,
    board: Array(9).fill(null),
    turn: startingPlayer,
    winner: null,
    winningLine: null,
    isDraw: false,
    isOver: false
  };
}
