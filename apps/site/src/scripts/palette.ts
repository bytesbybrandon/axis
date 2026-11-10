interface Item {
  name: string;
  description: string;
  url: string;
  install: string;
  tags: string[];
}

/** Command palette: Ctrl or Cmd K, or /, opens a search over every AXI. Enter opens one, Ctrl or Cmd Enter copies its command. */
export function initPalette(): void {
  if (/Mac|iPhone|iPad/.test(navigator.userAgent)) document.querySelectorAll('[data-mod]').forEach((k) => (k.textContent = '\u2318'));
  const dialog = document.querySelector<HTMLDialogElement>('dialog[data-palette]');
  const data = document.querySelector<HTMLScriptElement>('#axi-index');
  if (!dialog || !data) return;

  const items = JSON.parse(data.textContent ?? '[]') as Item[];
  const input = dialog.querySelector<HTMLInputElement>('input')!;
  const list = dialog.querySelector<HTMLUListElement>('[role="listbox"]')!;
  const status = dialog.querySelector<HTMLElement>('[data-palette-status]')!;
  let matches: Item[] = [];
  let index = 0;

  const render = (): void => {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    matches = items.filter((item) => {
      const hay = `${item.name} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    index = Math.min(index, Math.max(matches.length - 1, 0));
    list.replaceChildren(
      ...matches.map((item, i) => {
        const li = document.createElement('li');
        li.role = 'option';
        li.id = `palette-option-${i}`;
        li.className = 'palette__item';
        li.setAttribute('aria-selected', String(i === index));
        const name = document.createElement('span');
        name.className = 'palette__name';
        name.textContent = item.name;
        const what = document.createElement('span');
        what.className = 'palette__what';
        what.textContent = item.description;
        li.append(name, what);
        li.addEventListener('pointermove', () => select(i, false));
        li.addEventListener('click', () => location.assign(item.url));
        return li;
      }),
    );
    input.setAttribute('aria-activedescendant', matches.length ? `palette-option-${index}` : '');
    status.textContent = matches.length ? `${matches.length} of ${items.length} AXIs` : '0 AXIs match.';
  };

  const select = (next: number, scroll = true): void => {
    if (!matches.length) return;
    index = (next + matches.length) % matches.length;
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === index)));
    input.setAttribute('aria-activedescendant', `palette-option-${index}`);
    if (scroll) list.children[index]?.scrollIntoView({ block: 'nearest' });
  };

  const open = (): void => {
    if (dialog.open) return;
    input.value = '';
    index = 0;
    render();
    dialog.showModal();
    input.focus();
  };

  document.addEventListener('keydown', (event) => {
    const typing = (event.target as Element).closest('input, textarea, select, [contenteditable]');
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      open();
    } else if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      open();
    }
  });
  document.querySelectorAll('[data-palette-open]').forEach((b) => b.addEventListener('click', open));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  input.addEventListener('input', () => {
    index = 0;
    render();
  });
  input.addEventListener('keydown', async (event) => {
    if (event.key === 'ArrowDown') (event.preventDefault(), select(index + 1));
    else if (event.key === 'ArrowUp') (event.preventDefault(), select(index - 1));
    else if (event.key === 'Enter' && matches[index]) {
      event.preventDefault();
      if (event.metaKey || event.ctrlKey) {
        try {
          await navigator.clipboard.writeText(matches[index].install);
          status.textContent = `Copied ${matches[index].install}`;
        } catch {
          status.textContent = 'Could not copy. Select the command on the page.';
        }
      } else {
        location.assign(matches[index].url);
      }
    }
  });
}
