import './shims/process.ts';
// The real tttui-axi command layer, bundled from the workspace so the demo cannot drift from the package.
// @ts-expect-error plain JavaScript module outside the site
import { handleAxiCommand } from '../../../../packages/tttui-axi/src/axi.js';
import { highlight } from '../lib/highlight.ts';
import { runnableCommands } from '../lib/commands.ts';
import { files, readSession } from './shims/store.ts';

type Reply = { handled: boolean; output?: string; exitCode?: number };

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, reduced ? 0 : ms));

function init(root: HTMLElement): void {
  const cells = [...root.querySelectorAll<HTMLButtonElement>('[data-cell]')];
  const cmdEl = root.querySelector<HTMLElement>('[data-cmd]')!;
  const outEl = root.querySelector<HTMLElement>('[data-out]')!;
  const chipsEl = root.querySelector<HTMLElement>('[data-chips]')!;
  const meterEl = root.querySelector<HTMLElement>('[data-meter]')!;
  const liveEl = root.querySelector<HTMLElement>('[data-live]')!;
  const levels = [...root.querySelectorAll<HTMLInputElement>('input[name="level"]')];

  let replies = 0;
  let characters = 0;
  let busy = false;
  let last = '';

  const level = (): string => levels.find((l) => l.checked)?.value ?? 'easy';

  async function run(args: string[]): Promise<Reply> {
    const reply = handleAxiCommand(args) as Reply;
    const text = reply.output ?? '';
    last = text;
    replies += 1;
    characters += text.length;
    cmdEl.textContent = ['tttui', ...args].join(' ');
    meterEl.textContent = `${replies} ${replies === 1 ? 'reply' : 'replies'}, ${characters.toLocaleString('en-US')} characters`;
    const lines = text.split('\n');
    for (let i = 1; i <= lines.length; i += 1) {
      outEl.innerHTML = highlight(lines.slice(0, i).join('\n'));
      if (!reduced && i < lines.length) await sleep(16);
    }
    const note = /action: (.+)/.exec(text)?.[1];
    liveEl.textContent = note ?? (reply.exitCode ? text : '');
    paint();
    return reply;
  }

  function paint(): void {
    const s = readSession();
    cells.forEach((cell, i) => {
      const mark = s?.game.board[i] ?? '';
      cell.dataset.mark = mark;
      cell.textContent = mark;
      cell.dataset.win = s?.game.winningLine?.includes(i) ? 'true' : 'false';
      cell.disabled = busy || Boolean(mark) || Boolean(s?.game.isOver);
      cell.setAttribute('aria-label', mark ? `Cell ${i}, ${mark}` : `Place X in cell ${i}`);
    });
    chipsEl.replaceChildren(
      ...runnableCommands(last).map((command) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip chip--cmd';
        chip.textContent = command;
        chip.addEventListener('click', () => void play(command.replace(/^tttui\s*/, '').split(/\s+/).filter(Boolean)));
        chip.disabled = busy;
        return chip;
      }),
    );
  }

  async function play(args: string[]): Promise<void> {
    if (busy) return;
    busy = true;
    paint();
    const first = await run(args);
    // An AXI tells the agent what to run next. For a move, that is the computer's turn, so the demo runs it.
    if (args[0] === 'move' && !first.exitCode && !readSession()?.game.isOver) {
      await sleep(380);
      await run(['ai', level()]);
    }
    busy = false;
    paint();
  }

  cells.forEach((cell, i) => cell.addEventListener('click', () => void play(['move', String(i)])));
  root.classList.add('is-live');
  files.clear();
  busy = true;
  void run([]).then(() => {
    busy = false;
    paint();
  });
}

document.querySelectorAll<HTMLElement>('[data-play]').forEach(init);
