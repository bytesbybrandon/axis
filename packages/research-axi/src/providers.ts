// Provider field mappings informed by ip-search-mcp (Brandon D. Phillips), MIT.
// Reimplemented for research-axi's version, pagination and provenance contracts.
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { arxivId, ResearchError, type Paper, type Provider } from "./domain.ts";
import { Http } from "./http.ts";

type Obj = Record<string, unknown>;
const list = (value: unknown): unknown[] => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value];
const object = (value: unknown): Obj => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : {};
const string = (value: unknown): string => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
export type SearchPage = { papers: Paper[]; next: string | null; total: number | null };
/** Normalize Atom feeds while preserving exact returned arXiv versions. Perf: P2; O(feed bytes); target CC <= 15, coverage >= 70%, CRAP <= 25. */
export function parseArxiv(xml: string, fetchedAt: string): { papers: Paper[]; total: number | null } {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new ResearchError("PROVIDER_RESPONSE", "arxiv returned invalid or unsupported XML.", "arxiv");
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false }).parse(xml);
  if (!parsed.feed) throw new ResearchError("PROVIDER_RESPONSE", "arxiv response has no Atom feed.", "arxiv");
  const papers = list(parsed.feed.entry).map((entry) => {
    const e = object(entry); const raw = string(e.id).replace(/^https?:\/\/(export\.)?arxiv\.org\/abs\//, "");
    let id;
    try { id = arxivId(raw, true); } catch { throw new ResearchError("PROVIDER_RESPONSE", "arxiv did not return a supported version-pinned paper ID.", "arxiv"); }
    const title = string(e.title);
    if (!title) throw new ResearchError("PROVIDER_RESPONSE", "arxiv paper title is missing.", "arxiv");
    const doi = string(e.doi);
    return { id: `arxiv:${id.id}`, title, published: string(e.published), source: "arxiv" as const,
      version: id.version, authors: list(e.author).map((a) => string(object(a).name)).filter(Boolean), abstract: string(e.summary) || null,
      abstract_is_full_text: false as const, full_text: "arxiv_pdf" as const,
      links: { publication: `https://arxiv.org/abs/${id.id}`, pdf: `https://arxiv.org/pdf/${id.id}`, ...(doi ? { doi: `https://doi.org/${doi}` } : {}) }, fetched_at: fetchedAt };
  });
  const total = Number(parsed.feed.totalResults);
  return { papers, total: parsed.feed.totalResults !== undefined && Number.isSafeInteger(total) && total >= 0 ? total : null };
}
/** Reconstruct an abstract with bounded positions; this is explicitly discovery text. Perf: P2; O(abstract positions); target CC <= 15, coverage >= 70%, CRAP <= 25. */
export function abstractFromIndex(value: unknown): string | null {
  if (!value) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(object(value))) {
    for (const position of list(positions)) {
      if (!Number.isInteger(position) || Number(position) < 0 || Number(position) > 50_000) throw new ResearchError("PROVIDER_RESPONSE", "openalex abstract positions exceed supported bounds.", "openalex");
      words[Number(position)] = word;
    }
  }
  return words.filter(Boolean).join(" ") || null;
}
/** Normalize one discovery work without claiming a full-text version. Perf: P2; O(authors + abstract); target CC <= 15, coverage >= 70%, CRAP <= 25. */
export function parseOpenAlex(value: unknown, fetchedAt: string): Paper {
  const work = object(value), raw = string(work.id).replace(/^https:\/\/openalex\.org\//, "");
  const title = string(work.title) || string(work.display_name);
  if (!/^W\d{1,20}$/.test(raw) || !title) throw new ResearchError("PROVIDER_RESPONSE", "openalex returned an invalid work record.", "openalex");
  const doi = string(work.doi);
  return { id: `openalex:${raw}`, title, published: string(work.publication_date), source: "openalex", version: null,
    authors: list(work.authorships).map((a) => string(object(object(a).author).display_name)).filter(Boolean),
    abstract: abstractFromIndex(work.abstract_inverted_index), abstract_is_full_text: false, full_text: "discovery_only",
    links: { publication: `https://openalex.org/${raw}`, ...(doi.startsWith("https://doi.org/") ? { doi } : {}) }, fetched_at: fetchedAt };
}

export class Providers {
  readonly http: Http; private key?: string;
  constructor(http: Http, key = process.env.OPENALEX_API_KEY) { this.http = http; this.key = key; }
  /** Build only fixed OpenAlex endpoints, with explicit acknowledgement before sending a key. Perf: P0; O(path); target CC <= 8, coverage >= 90%, CRAP <= 10. */
  private openalex(path: string, allowCredits: boolean) {
    const url = new URL(path, "https://api.openalex.org");
    if (allowCredits) {
      if (!this.key?.trim()) throw new ResearchError("AUTH", "OPENALEX_API_KEY is missing; omit allow-credit-use for keyless access.", "openalex");
      url.searchParams.set("api_key", this.key.trim());
    }
    return url;
  }
  /** One provider page; caller owns global result bounds. Perf: P2; O(page bytes); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  async search(provider: Provider, query: string, limit: number, cursor: string | undefined, native: boolean, allowCredits: boolean): Promise<SearchPage> {
    if (provider === "arxiv") {
      const offset = cursor === undefined ? 0 : Number(cursor);
      if (!/^\d{1,5}$/.test(cursor ?? "0") || !Number.isInteger(offset) || offset > 10_000) throw new ResearchError("INVALID_CURSOR", "arxiv cursor must be an offset from 0 to 10000.", provider);
      const url = new URL("https://export.arxiv.org/api/query");
      url.searchParams.set("search_query", native ? query : `all:${JSON.stringify(query)}`);
      url.searchParams.set("start", String(offset)); url.searchParams.set("max_results", String(limit));
      const response = await this.http.get(provider, url);
      const result = parseArxiv(Buffer.from(response.bytes, "base64").toString(), response.fetched_at);
      if (result.papers.length > limit) throw new ResearchError("PROVIDER_RESPONSE", "arxiv exceeded the requested page size.", provider);
      return { ...result, next: result.papers.length === limit && (result.total === null || offset + limit < result.total) ? String(offset + limit) : null };
    }
    if (cursor && cursor !== "*" && !allowCredits) throw new ResearchError("AUTH_REQUIRED", "openalex cursor paging beyond page one requires a key and explicit --allow-credit-use true.", provider);
    const url = this.openalex("/works", allowCredits); url.searchParams.set("search", query);
    url.searchParams.set("per_page", String(limit)); url.searchParams.set("cursor", cursor ?? "*");
    const response = await this.http.get(provider, url);
    const data = this.json(response.bytes); const results = data.results;
    if (!Array.isArray(results) || results.length > limit || !data.meta) throw new ResearchError("PROVIDER_RESPONSE", "openalex returned an invalid search response.", provider);
    const meta = object(data.meta);
    return { papers: results.map((w) => parseOpenAlex(w, response.fetched_at)), next: typeof meta.next_cursor === "string" ? meta.next_cursor : null, total: typeof meta.count === "number" ? meta.count : null };
  }
  /** Get one normalized paper; latest arXiv IDs resolve to explicit versions. Perf: P2; O(metadata bytes); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  async get(provider: Provider, id: string, allowCredits: boolean): Promise<Paper> {
    if (provider === "arxiv") {
      const parsed = arxivId(id), url = new URL("https://export.arxiv.org/api/query"); url.searchParams.set("id_list", parsed.id);
      const response = await this.http.get(provider, url, parsed.version !== null);
      const { papers } = parseArxiv(Buffer.from(response.bytes, "base64").toString(), response.fetched_at);
      const paper = papers.find((p) => arxivId(p.id).base === parsed.base && (!parsed.version || p.version === parsed.version));
      if (!paper) throw new ResearchError("NOT_FOUND", "arxiv returned no matching paper version.", provider);
      return paper;
    }
    const response = await this.http.get(provider, this.openalex(`/works/${id}`, allowCredits));
    const paper = parseOpenAlex(this.json(response.bytes), response.fetched_at);
    if (paper.id !== `openalex:${id}`) throw new ResearchError("PROVIDER_RESPONSE", "openalex returned a different work ID.", provider);
    return paper;
  }
  /** Convert parse failures without exposing body content or secrets. Perf: P1; O(bytes); target CC <= 12, coverage >= 80%, CRAP <= 15. */
  private json(bytes: string): Obj {
    try { return object(JSON.parse(Buffer.from(bytes, "base64").toString())); }
    catch { throw new ResearchError("PROVIDER_RESPONSE", "openalex returned malformed JSON.", "openalex"); }
  }
}
