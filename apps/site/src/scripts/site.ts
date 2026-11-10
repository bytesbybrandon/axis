// Progressive enhancement only: with scripting off, every panel shows, the filter is inert and rows stay listed.

function initCopy(): void {
  document.addEventListener('click', async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-copy]');
    if (!button) return;
    const original = button.dataset.label ?? button.textContent ?? '';
    button.dataset.label = original;
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? '');
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Select and copy';
    }
    window.setTimeout(() => {
      button.textContent = original;
    }, 1600);
  });
}

function initTabs(): void {
  document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((root) => {
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const panels = tabs.map((tab) => root.querySelector<HTMLElement>(`#${tab.getAttribute('aria-controls')}`));
    const select = (index: number, focus: boolean): void => {
      tabs.forEach((tab, i) => {
        const on = i === index;
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
        panels[i]?.toggleAttribute('hidden', !on);
      });
      if (focus) tabs[index].focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i, false));
      tab.addEventListener('keydown', (event) => {
        const last = tabs.length - 1;
        const target = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[event.key];
        if (target === undefined) return;
        event.preventDefault();
        select(target, true);
      });
    });
    select(Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true')), false);
  });
}

function initFilter(): void {
  const form = document.querySelector<HTMLFormElement>('[data-filter]');
  const rows = [...document.querySelectorAll<HTMLElement>('[data-row]')];
  if (!form || rows.length === 0) return;
  const input = form.querySelector<HTMLInputElement>('input[type="search"]')!;
  const chips = [...form.querySelectorAll<HTMLButtonElement>('[data-tag]')];
  const shown = form.querySelector<HTMLElement>('[data-shown]')!;
  const empty = document.querySelector<HTMLElement>('[data-empty]')!;
  const ledger = document.querySelector<HTMLElement>('[data-ledger]')!;

  const apply = (): void => {
    const query = input.value.trim().toLowerCase();
    const active = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.tag!);
    let count = 0;
    for (const row of rows) {
      const tags = (row.dataset.tags ?? '').split(' ');
      const match = (!query || (row.dataset.text ?? '').includes(query)) && active.every((t) => tags.includes(t));
      row.hidden = !match;
      if (match) count += 1;
    }
    shown.textContent = String(count);
    empty.hidden = count > 0;
    ledger.hidden = count === 0;
  };

  form.addEventListener('submit', (event) => event.preventDefault());
  input.addEventListener('input', apply);
  chips.forEach((chip) =>
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', String(chip.getAttribute('aria-pressed') !== 'true'));
      apply();
    }),
  );
  document.querySelector('[data-clear]')?.addEventListener('click', () => {
    input.value = '';
    chips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
    apply();
    input.focus();
  });
}

initCopy();
initTabs();
initFilter();
