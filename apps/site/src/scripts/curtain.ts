/** A draggable curtain between the designed roster and the TOON an agent reads. It opens once on its own. */
export function initCurtain(): void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll<HTMLElement>('[data-curtain]').forEach((root) => {
    const range = root.querySelector<HTMLInputElement>('input[type="range"]')!;
    const rest = Number(range.dataset.rest ?? 40);
    const set = (value: number): void => {
      range.value = String(value);
      root.style.setProperty('--x', `${value}%`);
      range.setAttribute('aria-valuetext', `${Math.round(value)} percent of the width shows the page, the rest shows what an agent reads`);
    };
    range.addEventListener('input', () => {
      cancelled = true;
      set(Number(range.value));
    });
    let cancelled = false;
    set(reduced ? rest : 100);
    if (reduced) return;
    new IntersectionObserver(
      (entries, observer) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number): void => {
          if (cancelled) return;
          const t = Math.min((now - start) / 1400, 1);
          set(100 - (100 - rest) * (1 - (1 - t) ** 3));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    ).observe(root);
  });
}
