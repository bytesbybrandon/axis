/**
 * The roster: a filter, and a pinned stage that shows the bare output of whichever AXI is crossing the
 * middle of the screen. While it does, the page's hue (--hue) follows that AXI's own.
 */
export function initRoster(): void {
  const form = document.querySelector<HTMLFormElement>('[data-filter]');
  const rows = [...document.querySelectorAll<HTMLElement>('[data-row]')];
  const section = document.querySelector<HTMLElement>('#list');
  if (!form || !section || rows.length === 0) return;

  const root = document.documentElement;
  const panels = new Map([...section.querySelectorAll<HTMLElement>('[data-panel]')].map((p) => [p.dataset.panel!, p]));
  const input = form.querySelector<HTMLInputElement>('input[type="search"]')!;
  const chips = [...form.querySelectorAll<HTMLButtonElement>('[data-tag]')];
  const shown = form.querySelector<HTMLElement>('[data-shown]')!;
  const empty = section.querySelector<HTMLElement>('[data-empty]')!;
  const ledger = section.querySelector<HTMLElement>('[data-ledger]')!;
  const stage = section.querySelector<HTMLElement>('[data-stage]');

  let active: HTMLElement | undefined;
  let inView = false;

  const paintHue = (): void => {
    if (inView && active) root.style.setProperty('--hue', active.dataset.hue ?? '');
    else root.style.removeProperty('--hue');
  };

  const activate = (row: HTMLElement | undefined): void => {
    if (row === active) return;
    active?.classList.remove('is-active');
    active = row;
    row?.classList.add('is-active');
    panels.forEach((panel, name) => {
      panel.hidden = name !== row?.dataset.name;
    });
    paintHue();
  };

  const visible = (): HTMLElement[] => rows.filter((r) => !r.hidden);

  const rowObserver = new IntersectionObserver(
    (entries) => {
      const hit = entries.filter((e) => e.isIntersecting).at(-1);
      if (hit) activate(hit.target as HTMLElement);
    },
    { rootMargin: '-42% 0px -48% 0px' },
  );
  rows.forEach((row) => {
    rowObserver.observe(row);
    row.addEventListener('focusin', () => activate(row));
    row.addEventListener('pointerenter', () => {
      if (matchMedia('(hover: hover)').matches) activate(row);
    });
  });

  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      paintHue();
    },
    { rootMargin: '-30% 0px -30% 0px' },
  ).observe(section);

  const apply = (): void => {
    const query = input.value.trim().toLowerCase();
    const tags = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.tag!);
    let count = 0;
    for (const row of rows) {
      const own = (row.dataset.tags ?? '').split(' ');
      const match = (!query || (row.dataset.text ?? '').includes(query)) && tags.every((t) => own.includes(t));
      row.hidden = !match;
      if (match) count += 1;
    }
    shown.textContent = String(count);
    empty.hidden = count > 0;
    ledger.hidden = count === 0;
    if (stage) stage.hidden = count === 0;
    if (!active || active.hidden) {
      active = undefined;
      activate(visible()[0]);
    }
  };

  form.addEventListener('submit', (event) => event.preventDefault());
  input.addEventListener('input', apply);
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
      apply();
    }),
  );
  section.querySelector('[data-clear]')?.addEventListener('click', () => {
    input.value = '';
    chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
    apply();
    input.focus();
  });

  activate(visible()[0]);
}
