/**
 * AI Opponent Logic with Minimax & Difficulty Modes
 */
import { checkWinner, getAvailableMoves } from './game.js';

/**
 * Minimax algorithm for unbeatable play
 */
function minimax(board, player, depth, aiPlayer, humanPlayer) {
  const result = checkWinner(board);
  if (result.winner === aiPlayer) return { score: 10 - depth };
  if (result.winner === humanPlayer) return { score: depth - 10 };
  if (result.isDraw) return { score: 0 };

  const availableMoves = getAvailableMoves(board);

  if (player === aiPlayer) {
    let maxScore = -Infinity;
    let bestMove = availableMoves[0];

    for (const move of availableMoves) {
      board[move] = aiPlayer;
      const { score } = minimax(board, humanPlayer, depth + 1, aiPlayer, humanPlayer);
      board[move] = null;

      if (score > maxScore) {
        maxScore = score;
        bestMove = move;
      }
    }
    return { score: maxScore, move: bestMove };
  } else {
    let minScore = Infinity;
    let bestMove = availableMoves[0];

    for (const move of availableMoves) {
      board[move] = humanPlayer;
      const { score } = minimax(board, aiPlayer, depth + 1, aiPlayer, humanPlayer);
      board[move] = null;

      if (score < minScore) {
        minScore = score;
        bestMove = move;
      }
    }
    return { score: minScore, move: bestMove };
  }
}

/**
 * Selects an optimal or weighted move based on difficulty
 * @param {Array} board 9-element board array
 * @param {string} aiPlayer 'O' or 'X'
 * @param {'easy'|'medium'|'unbeatable'} difficulty
 * @returns {number|null} Chosen move index (0-8) or null if no moves available
 */
export function getBestMove(board, aiPlayer = 'O', difficulty = 'unbeatable') {
  const availableMoves = getAvailableMoves(board);
  if (availableMoves.length === 0) return null;

  const humanPlayer = aiPlayer === 'X' ? 'O' : 'X';

  // 1. Easy mode: Random move
  if (difficulty === 'easy') {
    const randomIndex = Math.floor(Math.random() * availableMoves.length);
    return availableMoves[randomIndex];
  }

  // 2. Medium mode: Win if possible, block if necessary, else 50% chance random or minimax
  if (difficulty === 'medium') {
    // Check immediate win
    for (const move of availableMoves) {
      board[move] = aiPlayer;
      if (checkWinner(board).winner === aiPlayer) {
        board[move] = null;
        return move;
      }
      board[move] = null;
    }

    // Check immediate block
    for (const move of availableMoves) {
      board[move] = humanPlayer;
      if (checkWinner(board).winner === humanPlayer) {
        board[move] = null;
        return move;
      }
      board[move] = null;
    }

    // Randomize between minimax and casual pick
    if (Math.random() < 0.5) {
      const randomIndex = Math.floor(Math.random() * availableMoves.length);
      return availableMoves[randomIndex];
    }
  }

  // 3. Unbeatable mode (or medium fallback): Full Minimax
  const { move } = minimax([...board], aiPlayer, 0, aiPlayer, humanPlayer);
  return move !== undefined ? move : availableMoves[0];
}
