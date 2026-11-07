#!/usr/bin/env node

/**
 * Terminal TUI Tic-Tac-Toe Executable
 */
import { createGame, makeMove, resetRound } from '../src/game.js';
import { getBestMove } from '../src/ai.js';
import { renderView, ANSI } from '../src/tui.js';
import { setupRawInput } from '../src/input.js';
import { playTone } from '../src/audio.js';
import { handleAxiCommand } from '../src/axi.js';

// Process AXI command line invocation or non-interactive execution
const axi = handleAxiCommand();
if (axi.handled) {
  if (axi.output) {
    if (axi.exitCode === 0) {
      process.stdout.write(axi.output + '\n');
    } else {
      process.stderr.write(axi.output + '\n');
    }
  }
  process.exit(axi.exitCode || 0);
}

class TicTacToeApp {
  constructor() {
    this.game = createGame('X');
    this.cursor = 4; // Start at center
    this.mode = 'pve'; // 'pve' or 'pvp'
    this.difficulty = 'unbeatable'; // 'easy', 'medium', 'unbeatable'
    this.soundEnabled = true;
    this.roundNumber = 1;
    this.statusMessage = null;
    this.statusTimeout = null;
    this.isAiThinking = false;
    this.cleanedUp = false;

    this.cleanupInput = null;
  }

  start() {
    // Enable alternate screen buffer, hide cursor, and initial clear
    process.stdout.write(ANSI.enterAltScreen + ANSI.hideCursor + ANSI.clearScreen);

    // Setup input
    this.cleanupInput = setupRawInput((key) => this.handleKey(key));

    // Register exit handlers
    this.registerExitHandlers();

    // Initial render
    this.render();
  }

  cleanup() {
    if (this.cleanedUp) return;
    this.cleanedUp = true;

    if (this.cleanupInput) {
      this.cleanupInput();
    }

    process.stdout.write(ANSI.showCursor + ANSI.exitAltScreen);
  }

  registerExitHandlers() {
    const exitCleanly = () => {
      this.cleanup();
      process.exit(0);
    };

    process.on('SIGINT', exitCleanly);
    process.on('SIGTERM', exitCleanly);
    process.on('exit', () => this.cleanup());
    process.on('uncaughtException', (err) => {
      this.cleanup();
      console.error('Fatal error:', err);
      process.exit(1);
    });
  }

  setStatus(msg, durationMs = 2000) {
    if (this.statusTimeout) clearTimeout(this.statusTimeout);
    this.statusMessage = msg;
    this.render();

    this.statusTimeout = setTimeout(() => {
      this.statusMessage = null;
      this.render();
    }, durationMs);
  }

  handleKey(key) {
    if (key.name === 'exit') {
      this.cleanup();
      process.exit(0);
      return;
    }

    if (this.isAiThinking) {
      return; // Block input while AI is deliberating
    }

    switch (key.name) {
      case 'up':
        this.cursor = (this.cursor - 3 + 9) % 9;
        this.render();
        break;

      case 'down':
        this.cursor = (this.cursor + 3) % 9;
        this.render();
        break;

      case 'left':
        this.cursor = this.cursor % 3 === 0 ? this.cursor + 2 : this.cursor - 1;
        this.render();
        break;

      case 'right':
        this.cursor = this.cursor % 3 === 2 ? this.cursor - 2 : this.cursor + 1;
        this.render();
        break;

      case 'cell':
        this.cursor = key.index;
        this.makePlayerMove(this.cursor);
        break;

      case 'select':
        if (this.game.isOver) {
          this.restartRound();
        } else {
          this.makePlayerMove(this.cursor);
        }
        break;

      case 'restart':
        this.restartRound();
        break;

      case 'mode':
        this.toggleMode();
        break;

      case 'difficulty':
        this.toggleDifficulty();
        break;

      case 'sound':
        this.toggleSound();
        break;

      default:
        break;
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    playTone('toggle', this.soundEnabled);
    this.setStatus(`${ANSI.cyan}Sound: ${this.soundEnabled ? 'ON 🔊' : 'OFF 🔇'}${ANSI.reset}`);
  }

  makePlayerMove(index) {
    if (this.game.isOver) {
      playTone('invalid', this.soundEnabled);
      this.setStatus(`${ANSI.yellow}Round finished! Press [R] for next round.${ANSI.reset}`);
      return;
    }

    const res = makeMove(this.game, index);
    if (!res.success) {
      playTone('invalid', this.soundEnabled);
      this.setStatus(`${ANSI.red}${res.reason}!${ANSI.reset}`, 1500);
      return;
    }

    this.game = res.game;
    this.render();

    if (this.game.winner) {
      playTone('win', this.soundEnabled);
    } else if (this.game.isDraw) {
      playTone('draw', this.soundEnabled);
    } else {
      playTone('move', this.soundEnabled);
    }

    // Check if AI turn should follow
    if (this.mode === 'pve' && !this.game.isOver && this.game.turn === 'O') {
      this.triggerAiTurn();
    }
  }

  triggerAiTurn() {
    this.isAiThinking = true;
    this.render();

    setTimeout(() => {
      if (this.cleanedUp) return;

      const aiMove = getBestMove(this.game.board, 'O', this.difficulty);
      if (aiMove !== null) {
        const res = makeMove(this.game, aiMove);
        if (res.success) {
          this.game = res.game;
          if (this.game.winner) {
            playTone('win', this.soundEnabled);
          } else if (this.game.isDraw) {
            playTone('draw', this.soundEnabled);
          } else {
            playTone('move', this.soundEnabled);
          }
        }
      }

      this.isAiThinking = false;
      this.render();
    }, 200); // 200ms natural hesitation
  }

  restartRound() {
    this.roundNumber += 1;
    // Alternate starting player in 2-player mode, start with X in PvE
    const starter = this.mode === 'pvp' ? (this.roundNumber % 2 === 1 ? 'X' : 'O') : 'X';
    this.game = resetRound(this.game, starter);
    this.cursor = 4;
    this.setStatus(`${ANSI.cyan}Round ${this.roundNumber} started! Player ${starter} goes first.${ANSI.reset}`);
  }

  toggleMode() {
    this.mode = this.mode === 'pve' ? 'pvp' : 'pve';
    this.setStatus(`${ANSI.cyan}Switched mode to: ${this.mode === 'pve' ? 'Player vs AI' : '2-Player Local'}${ANSI.reset}`);

    // If switched to vs AI mid-round during AI's turn, trigger AI immediately
    if (this.mode === 'pve' && !this.game.isOver && this.game.turn === 'O') {
      this.triggerAiTurn();
    }
  }

  toggleDifficulty() {
    if (this.mode !== 'pve') {
      this.setStatus(`${ANSI.yellow}Difficulty only applies in vs AI mode (press [M] to toggle).${ANSI.reset}`);
      return;
    }

    const order = ['easy', 'medium', 'unbeatable'];
    const nextIdx = (order.indexOf(this.difficulty) + 1) % order.length;
    this.difficulty = order[nextIdx];
    this.setStatus(`${ANSI.brightYellow}AI Difficulty set to: ${this.difficulty.toUpperCase()}${ANSI.reset}`);
  }

  render() {
    const view = renderView({
      game: this.game,
      cursor: this.cursor,
      mode: this.mode,
      difficulty: this.difficulty,
      roundNumber: this.roundNumber,
      statusMessage: this.statusMessage,
      soundEnabled: this.soundEnabled
    });

    process.stdout.write(ANSI.cursorHome + view);
  }
}

// Auto-run when executed directly
const app = new TicTacToeApp();
app.start();
