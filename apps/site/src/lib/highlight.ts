const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ESC[c]);
}

/** Marks up TOON-style output: keys, and the backticked commands an AXI suggests. Input is escaped first. */
export function highlight(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const safe = escapeHtml(line);
      const keyed = safe.replace(/^(\s*)([A-Za-z_][\w-]*(?:\[\d+\])?(?:\{[^}]*\})?)(:)(?=\s|$)/, '$1<span class="k">$2</span>$3');
      return keyed.replace(/`([^`]+)`/g, '<code class="cmd">$1</code>');
    })
    .join('\n');
}
