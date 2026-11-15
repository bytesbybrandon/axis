import { createHash } from "node:crypto";

export type Provider = "arxiv" | "openalex";
export type Paper = {
  id: string; title: string; published: string; source: Provider;
  version: string | null; authors: string[]; abstract: string | null;
  abstract_is_full_text: false; full_text: "arxiv_pdf" | "discovery_only";
  links: { publication: string; pdf?: string; doi?: string };
  fetched_at: string;
};
export type Page = { page: number; text: string };
export type Document = {
  source: string; version: string; url: string; hash: string; fetched_at: string;
  method: string; total_pages: number | null; pages: Page[];
  extraction_bounds: { from_page: number; to_page: number; max_pages: number; max_characters: number };
  omitted_pages: number | null; truncated: boolean; limitations: string[];
};
export type Locator = { page: number; start: number; end: number };
export type Citation = {
  source: string; version: string; url: string; document_hash: string; fetched_at: string;
  extraction_method: string; locator: Locator; text: string;
};

export class ResearchError extends Error {
  code: string; provider?: Provider; hint: string;
  constructor(code: string, message: string, provider?: Provider, hint = "Run research-axi --help.") { super(message); this.code = code; this.provider = provider; this.hint = hint; }
  toProblem() { return { error: this.message, code: this.code, provider: this.provider ?? null, next: this.hint }; }
}
/** Safe public error conversion. Perf: P0; O(1); target CC <= 8, coverage >= 90%, CRAP <= 10. */
export function problem(error: unknown) {
  return error instanceof ResearchError ? error.toProblem() : new ResearchError("INTERNAL", "Operation failed; no paper text was produced.").toProblem();
}
/** Exact content/cache identity. Perf: P1; O(bytes); target CC <= 12, coverage >= 80%, CRAP <= 15. */
export function hash(data: string | Uint8Array): string { return createHash("sha256").update(data).digest("hex"); }
/** Constrain accepted arXiv IDs, including legacy IDs, without accepting arbitrary URLs. Perf: P0; O(id); target CC <= 8, coverage >= 90%, CRAP <= 10. */
export function arxivId(value: string, pinned = false): { base: string; version: string | null; id: string } {
  const id = value.replace(/^arxiv:/i, "");
  const match = /^(\d{4}\.\d{4,5}|[a-z][a-z.-]*\/\d{7})(v[1-9]\d{0,3})?$/.exec(id);
  if (!match || (pinned && !match[2])) throw new ResearchError("INVALID_ID", "Use an arXiv ID such as 2501.13956v1; exact versions are required for document access.", "arxiv");
  return { base: match[1], version: match[2] ?? null, id };
}
/** Normalize supported metadata identifiers. Perf: P0; O(id); target CC <= 8, coverage >= 90%, CRAP <= 10. */
export function paperId(value: string): { provider: Provider; id: string } {
  if (/^(openalex:)?W\d{1,20}$/.test(value)) return { provider: "openalex", id: value.replace(/^openalex:/, "") };
  return { provider: "arxiv", id: arxivId(value).id };
}
/** Construct a citation from an exact extracted slice. Offsets are UTF-16 within that extracted page. Perf: P1; O(text); target CC <= 12, coverage >= 80%, CRAP <= 15. */
export function citation(document: Document, page: Page, start: number, end: number): Citation {
  return { source: document.source, version: document.version, url: document.url, document_hash: document.hash,
    fetched_at: document.fetched_at, extraction_method: document.method, locator: { page: page.page, start, end }, text: page.text.slice(start, end) };
}
