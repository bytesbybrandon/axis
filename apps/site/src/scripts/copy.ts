/** Any [data-copy] button copies its value and says so for a moment. */
export function initCopy(): void {
  document.addEventListener('click', async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-copy]');
    if (!button) return;
    const label = button.querySelector<HTMLElement>('[data-copy-label]') ?? button;
    const original = label.dataset.original ?? label.textContent ?? '';
    label.dataset.original = original;
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? '');
      label.textContent = 'Copied';
    } catch {
      label.textContent = 'Select and copy';
    }
    window.setTimeout(() => {
      label.textContent = original;
    }, 1600);
  });
}
