// Runs only our extractor adapter, never instructions/scripts from the document.
import { getDocumentProxy, getResolvedPDFJS } from "unpdf";

/** Extract one bounded page window; parent enforces memory/output/time caps. Perf: P2; O(selected page text); target CC <= 15, coverage >= 70%, CRAP <= 25. */
async function extract() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const input = JSON.parse(Buffer.concat(chunks).toString());
  // No external font, CMap, image or URL retrieval is permitted during parsing.
  globalThis.fetch = async () => { throw new Error("External retrieval disabled"); };
  const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(input.bytes, "base64")), {
    useSystemFonts: false, disableFontFace: true, useWasm: false, enableXfa: false,
    maxImageSize: 1_000_000, useWorkerFetch: false, stopAtErrors: true,
  });
  try {
    const pages: { page: number; text: string }[] = []; let count = 0; let truncated = false;
    const last = Math.min(pdf.numPages, input.to);
    for (let n = input.from; n <= last; n++) {
      const page = await pdf.getPage(n); const content = await page.getTextContent();
      const text = content.items.map((item) => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
      const bounded = text.slice(0, Math.max(0, 2_000_000 - count));
      pages.push({ page: n, text: bounded }); count += bounded.length;
      if (bounded.length !== text.length) { truncated = true; break; }
      page.cleanup();
    }
    const { version } = await getResolvedPDFJS();
    return { pages, total_pages: pdf.numPages, truncated, method: `unpdf/1.9.1; PDF.js/${version}; page text (no OCR)` };
  } finally { await pdf.loadingTask.destroy(); }
}
// PDF.js may log warnings; keep stdout exclusively for the adapter result.
console.log = console.warn = console.info = () => {};
try { process.stdout.write(JSON.stringify(await extract())); }
catch { process.stdout.write(JSON.stringify({ failure: true })); process.exitCode = 1; }
