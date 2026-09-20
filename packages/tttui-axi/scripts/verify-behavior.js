import assert from 'node:assert/strict';
import { createGame, makeMove, checkWinner, resetRound, getAvailableMoves } from '../src/game.js';
import { getBestMove } from '../src/ai.js';
import { renderView } from '../src/tui.js';
import { parseKey } from '../src/input.js';

console.log('--- Starting SDLC Verification Checks ---');

// Check 1: Input parsing
console.log('Running Check 1: Key parsing...');
assert.deepEqual(parseKey('\u001b[A'), { name: 'up', type: 'move' });
assert.deepEqual(parseKey('\u001b[B'), { name: 'down', type: 'move' });
assert.deepEqual(parseKey('\u001b[C'), { name: 'right', type: 'move' });
assert.deepEqual(parseKey('\u001b[D'), { name: 'left', type: 'move' });
assert.deepEqual(parseKey('w'), { name: 'up', type: 'move' });
assert.deepEqual(parseKey('s'), { name: 'down', type: 'move' });
assert.deepEqual(parseKey('a'), { name: 'left', type: 'move' });
assert.deepEqual(parseKey('d'), { name: 'right', type: 'move' });
assert.deepEqual(parseKey(' '), { name: 'select', type: 'action' });
assert.deepEqual(parseKey('\r'), { name: 'select', type: 'action' });
assert.deepEqual(parseKey('r'), { name: 'restart', type: 'command' });
assert.deepEqual(parseKey('m'), { name: 'mode', type: 'command' });
assert.deepEqual(parseKey('t'), { name: 'difficulty', type: 'command' });
assert.deepEqual(parseKey('\t'), { name: 'difficulty', type: 'command' });
assert.deepEqual(parseKey('5'), { name: 'cell', index: 4, type: 'jump' });
assert.deepEqual(parseKey('q'), { name: 'exit', type: 'system' });
assert.deepEqual(parseKey('\u0003'), { name: 'exit', type: 'system' });
console.log('✓ Check 1 Passed: Input parser correctly parses all specified keys.');

// Check 2: Pure game logic - Win detection
console.log('Running Check 2: Win detection across rows, cols, diagonals...');
let g = createGame('X');
// X moves 0, O moves 3, X moves 1, O moves 4, X moves 2 (Row 0 win)
g = makeMove(g, 0).game;
g = makeMove(g, 3).game;
g = makeMove(g, 1).game;
g = makeMove(g, 4).game;
const rowWin = makeMove(g, 2);
assert.equal(rowWin.success, true);
assert.equal(rowWin.game.winner, 'X');
assert.deepEqual(rowWin.game.winningLine, [0, 1, 2]);
assert.equal(rowWin.game.scores.X, 1);
assert.equal(rowWin.game.isOver, true);
console.log('✓ Check 2 Passed: Win detection across row 0 correctly identified with line [0, 1, 2].');

// Check 3: Invalid move rejection
console.log('Running Check 3: Cell overwrite rejection...');
const invalidRes = makeMove(rowWin.game, 0);
assert.equal(invalidRes.success, false);
console.log('✓ Check 3 Passed: Occupied/finished cell rejects additional moves.');

// Check 4: Draw detection
console.log('Running Check 4: Draw game evaluation...');
// Draw board:
// X O X
// X O O
// O X X
const drawBoard = [
  'X', 'O', 'X',
  'X', 'O', 'O',
  'O', 'X', 'X'
];
const drawResult = checkWinner(drawBoard);
assert.equal(drawResult.winner, null);
assert.equal(drawResult.isDraw, true);
console.log('✓ Check 4 Passed: Full board without winning triplet flags draw correctly.');

// Check 5: Minimax unbeatable AI
console.log('Running Check 5: Minimax AI logic...');
// If human has 2 in a row [0, 1], AI as O must block at 2
const blockBoard = [
  'X', 'X', null,
  'O', null, null,
  null, null, null
];
const aiBlockMove = getBestMove(blockBoard, 'O', 'unbeatable');
assert.equal(aiBlockMove, 2, `AI should block at 2, but chose ${aiBlockMove}`);

// If AI has 2 in a row [3, 4], AI must take win at 5
const winBoard = [
  'X', 'X', null,
  'O', 'O', null,
  'X', null, null
];
const aiWinMove = getBestMove(winBoard, 'O', 'unbeatable');
assert.equal(aiWinMove, 5, `AI should complete win at 5, but chose ${aiWinMove}`);

// Minimax vs Minimax self-play should always terminate in a Draw (optimal play)
let simGame = createGame('X');
while (!simGame.isOver) {
  const best = getBestMove(simGame.board, simGame.turn, 'unbeatable');
  assert(best !== null, 'Should find a valid move');
  simGame = makeMove(simGame, best).game;
}
assert.equal(simGame.isDraw, true, 'Optimal play against itself must result in a Draw');
console.log('✓ Check 5 Passed: AI blocks threats, takes winning moves, and optimal play produces Draw.');

// Check 6: TUI Rendering Output
console.log('Running Check 6: ANSI TUI view rendering...');
const renderedOutput = renderView({
  game: simGame,
  cursor: 4,
  mode: 'pve',
  difficulty: 'unbeatable',
  roundNumber: 1,
  statusMessage: null
});
assert(renderedOutput.includes('TERMINAL TUI TIC-TAC-TOE'), 'Must contain header banner');
assert(renderedOutput.includes('Round:'), 'Must contain round counter');
assert(renderedOutput.includes('Draw'), 'Must reflect draw status');
assert(/Ties:[\s\S]*?1/.test(renderedOutput), 'Must display updated ties score');
console.log('✓ Check 6 Passed: TUI view cleanly generates formatted ANSI output.');

// Check 7: Round Reset
console.log('Running Check 7: Round reset preserves scores...');
const resetG = resetRound(simGame, 'O');
assert.equal(resetG.scores.ties, 1);
assert.equal(resetG.winner, null);
assert.equal(resetG.turn, 'O');
assert(resetG.board.every(c => c === null));
console.log('✓ Check 7 Passed: Round reset clears grid while preserving accumulated scores.');

console.log('\nAll 7 SDLC behavior checks PASSED with flying colors!');
