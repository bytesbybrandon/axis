import { spawn } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { LocalCache, boundedFile, MAX_DOWNLOAD } from "./cache.ts";
import { arxivId, hash, ResearchError, type Document, type Page } from "./domain.ts";
import { Http } from "./http.ts";
import { Providers } from "./providers.ts";

type Extraction = { pages: Page[]; total_pages: number; truncated: boolean; method: string };
/** Isolate parser work with a wall deadline, bounded stdout and a JS heap cap. Perf: P2; O(selected text + bytes); target CC <= 15, coverage >= 70%, CRAP <= 25. */
export async function extractPdf(bytes: Buffer, from: number, to: number): Promise<Extraction | null> {
  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, ["--max-old-space-size=256", fileURLToPath(new URL(`./pdf-worker.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`, import.meta.url))], {
      stdio: ["pipe", "pipe", "ignore"], env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT },
    });
    const chunks: Buffer[] = []; let size = 0;
    const timer = setTimeout(() => child.kill("SIGKILL"), 30_000);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 12 * 1024 * 1024) child.kill("SIGKILL"); else chunks.push(chunk);
    });
    child.stdin.on("error", () => {});
    child.once("error", () => { clearTimeout(timer); resolveResult(null); });
    child.once("close", (code) => {
      clearTimeout(timer);
      try {
        const output = JSON.parse(Buffer.concat(chunks).toString());
        resolveResult(code === 0 && Array.isArray(output.pages) ? output : null);
      } catch { resolveResult(null); }
    });
    child.stdin.end(JSON.stringify({ bytes: bytes.toString("base64"), from, to }));
  });
}

export class Documents {
  readonly cache: LocalCache; readonly http: Http; readonly providers: Providers;
  constructor(cache: LocalCache, http: Http, providers: Providers) { this.cache = cache; this.http = http; this.providers = providers; }
  /** Obtain only fixed-host pinned arXiv PDFs or an explicitly requested local regular PDF. Perf: P2; O(capped bytes); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  async load(source: string, from: number, to: number): Promise<Document> {
    let bytes: Buffer, sourceId: string, version: string, url: string, fetchedAt: string;
    if (source.startsWith("local:")) {
      const path = resolve(source.slice(6));
      try { bytes = await boundedFile(path, MAX_DOWNLOAD); }
      catch (error) { if (error instanceof ResearchError) throw error; throw new ResearchError("LOCAL_FILE", "Cannot read the requested local PDF."); }
      const digest = hash(bytes); sourceId = `local:sha256:${digest}`; version = `sha256:${digest}`;
      url = pathToFileURL(path).href; fetchedAt = new Date().toISOString();
    } else {
      let parsed = arxivId(source);
      if (!parsed.version) parsed = arxivId((await this.providers.get("arxiv", parsed.id, false)).id, true);
      sourceId = `arxiv:${parsed.id}`; version = parsed.version!; url = `https://arxiv.org/pdf/${parsed.id}`;
      const response = await this.http.get("arxiv", new URL(url), true);
      if (!/^application\/pdf(?:\s*;|\s*$)/i.test(response.content_type)) throw new ResearchError("UNSAFE_DOWNLOAD", "arxiv returned non-PDF content; full text was not extracted.", "arxiv");
      bytes = Buffer.from(response.bytes, "base64"); fetchedAt = response.fetched_at;
    }
    if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new ResearchError("UNSAFE_DOWNLOAD", "Requested source has no PDF signature; full text was not extracted.");
    const digest = hash(bytes), key = `document:v1:${sourceId}:${digest}:${from}:${to}`;
    return this.cache.exclusive(`extract:${key}`, async () => {
      const cached = await this.cache.get<Document>(key);
      if (cached) return { ...cached, url }; // local aliases still identify the requested file.
      const extracted = await extractPdf(bytes, from, to);
      const pages = extracted?.pages ?? [];
      const total = extracted?.total_pages ?? null;
      const limitations: string[] = [];
      if (!extracted) limitations.push("PDF extraction failed, exceeded resource limits, or requires a password; no paper text is available. No OCR was attempted.");
      const empty = pages.filter((p) => !p.text.trim()).map((p) => p.page);
      if (empty.length) limitations.push(`No extractable text on pages ${empty.join(", ")}; these may be scanned or contain images. No OCR was attempted.`);
      if (extracted && from > extracted.total_pages) limitations.push("Requested page window is beyond the document's last page.");
      limitations.push("PDF text order and mathematical/table layout may differ from the rendered paper. Section labels are not inferred; locators use PDF page numbers and text offsets.");
      const document: Document = { source: sourceId, version, url, hash: digest, fetched_at: fetchedAt,
        method: extracted?.method ?? "unpdf/1.9.1; extraction failed (no OCR)", total_pages: total, pages,
        extraction_bounds: { from_page: from, to_page: to, max_pages: 100, max_characters: 2_000_000 },
        omitted_pages: total === null ? null : Math.max(0, total - pages.length), truncated: !extracted || extracted.truncated || (total !== null && total > pages.length), limitations };
      // Cache successful extraction; a failed adapter run can be retried without deleting source bytes.
      if (extracted) await this.cache.put(key, document);
      return document;
    });
  }
}
