import { LocalCache } from "./cache.ts";
import { Documents } from "./documents.ts";
import { citation, paperId, problem, ResearchError, type Citation, type Document, type Paper, type Provider } from "./domain.ts";
import { Http, type Fetcher } from "./http.ts";
import { Providers } from "./providers.ts";

export type Args = Record<string, string | number | boolean>;
/** Select bounded page slices and exact citations without modifying extracted text. Perf: P2; O(selected text); target CC <= 15, coverage >= 70%, CRAP <= 25. */
export function passages(document: Document, maxCharacters: number, query?: string, limit = 10) {
  const citations: Citation[] = []; let remaining = maxCharacters; let matches = 0; let returned = 0;
  for (const page of document.pages) {
    if (!query) {
      const end = Math.min(page.text.length, remaining);
      if (end) { citations.push(citation(document, page, 0, end)); remaining -= end; returned += end; }
      continue;
    }
    // Literal, case-sensitive search preserves exact UTF-16 offsets (no regex or Unicode folding).
    let at = 0;
    while ((at = page.text.indexOf(query, at)) !== -1) {
      matches++;
      const start = Math.max(0, at - 160), end = Math.min(page.text.length, at + query.length + 160);
      if (citations.length < limit && remaining >= query.length) {
        const boundedStart = remaining >= end - start ? start : at;
        const boundedEnd = Math.min(end, boundedStart + remaining);
        const entry = citation(document, page, boundedStart, boundedEnd);
        citations.push(entry); remaining -= entry.text.length; returned += entry.text.length;
      }
      at += query.length;
    }
  }
  const extractedCharacters = document.pages.reduce((n, p) => n + p.text.length, 0);
  let covered = 0;
  for (const page of document.pages) {
    let end = 0;
    for (const c of citations.filter((c) => c.locator.page === page.page).sort((a, b) => a.locator.start - b.locator.start)) {
      covered += Math.max(0, c.locator.end - Math.max(end, c.locator.start)); end = Math.max(end, c.locator.end);
    }
  }
  return { citations, matches_in_window: query ? matches : null, omitted_matches: query ? matches - citations.length : null,
    returned_characters: returned, omitted_characters_in_window: Math.max(0, extractedCharacters - covered),
    truncated: document.truncated || remaining === 0 || (query !== undefined && matches > citations.length) };
}

export class Research {
  readonly cache: LocalCache; readonly providers: Providers; readonly documents: Documents;
  constructor(options: { cache?: LocalCache; fetcher?: Fetcher; openalexKey?: string } = {}) {
    this.cache = options.cache ?? new LocalCache(); const http = new Http(this.cache, options.fetcher);
    this.providers = new Providers(http, options.openalexKey); this.documents = new Documents(this.cache, http, this.providers);
  }
  /** One explicit provider selection, returning partial results when only one succeeds. Perf: P2; O(bounded provider pages); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  async search(args: Args) {
    const selected: Provider[] = args.provider === "both" ? ["arxiv", "openalex"] : [args.provider as Provider];
    const papers: Paper[] = [], errors: ReturnType<typeof problem>[] = [];
    const paging: Record<string, { next: string | null; total: number | null }> = {};
    for (const provider of selected) {
      try {
        const result = await this.providers.search(provider, String(args.query), Number(args.limit), args[`${provider}-cursor`] as string | undefined, args.native === true, args["allow-credit-use"] === true);
        papers.push(...result.papers); paging[provider] = { next: result.next, total: result.total };
        for (const paper of result.papers) await this.remember(paper);
      } catch (error) { errors.push({ ...problem(error), provider }); }
    }
    return { status: errors.length === selected.length ? "error" : errors.length ? "partial" : "ok", papers, empty: errors.length === 0 && papers.length === 0,
      providers: selected, paging, bounds: { per_provider: args.limit, maximum_results: Number(args.limit) * selected.length }, errors,
      next: "Use get <id> for metadata; read <arxiv:id> for full text. Page using the matching --arxiv-cursor or --openalex-cursor." };
  }
  /** Normalized metadata is reused by both transports; pinned arXiv records do not expire. Perf: P2; O(metadata bytes); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  async get(args: Args) {
    const id = paperId(String(args.id));
    const key = `metadata:v1:${id.provider}:${id.id}:${args["allow-credit-use"] === true ? "opted-in" : "keyless"}`;
    const cached = await this.cache.get<Paper>(key) ?? await this.cache.get<Paper>(`normalized:${id.provider}:${id.id}`);
    if (cached) return { status: "ok", paper: cached };
    const paper = await this.providers.get(id.provider, id.id, args["allow-credit-use"] === true);
    await this.cache.put(key, paper, id.provider === "arxiv" && /v\d+$/.test(id.id) ? null : 86_400_000);
    await this.remember(paper);
    return { status: "ok", paper };
  }
  /** Record bounded discovery summaries separately for local home. Perf: P1; O(paper bytes); target CC <= 12, coverage >= 80%, CRAP <= 15. */
  private async remember(paper: Paper) {
    await this.cache.put(`normalized:${paper.id}`, paper, paper.version ? null : 86_400_000);
    await this.cache.exclusive("home-index", async () => {
      const summaries = await this.cache.get<{ id: string; title: string; published: string; source: string }[]>("home-index") ?? [];
      await this.cache.put("home-index", [{ id: paper.id, title: paper.title, published: paper.published, source: paper.source }, ...summaries.filter((p) => p.id !== paper.id)].slice(0, 20));
    });
  }
  /** Recreate a directly requested exact passage citation; refuse invalid/out-of-window offsets. Perf: P2; O(page text); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  async cite(args: Args) {
    const pageNumber = Number(args.page), start = Number(args.start), end = Number(args.end);
    const document = await this.documents.load(String(args.source), pageNumber, pageNumber);
    const page = document.pages[0];
    if (!page || end > page.text.length) throw new ResearchError("INVALID_LOCATOR", "Citation locator exceeds available extracted page text; inspect read/find limitations first.");
    const { pages: _pages, ...provenance } = document;
    return { status: "ok", document: provenance, citation: citation(document, page, start, end), bounds: { page: pageNumber, start, end, max_characters: 20_000 }, content_is_untrusted_data: true };
  }
  /** Shared read/find/cite result: provenance, exact slices, limits and extraction limitations. Perf: P2; O(selected text); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  async read(args: Args, find = false) {
    const from = Number(args["from-page"]), to = Number(args["to-page"]);
    const document = await this.documents.load(String(args.source), from, to);
    const { pages, ...provenance } = document;
    const selected = passages(document, Number(args["max-characters"]), find ? String(args.query) : undefined, Number(args.limit));
    const readable = pages.some((p) => p.text.trim().length > 0);
    return { status: readable ? "ok" : "limited", document: provenance,
      bounds: { from_page: from, to_page: to, max_characters: args["max-characters"], ...(find ? { query: args.query, match_limit: args.limit, search: "literal case-sensitive" } : {}) },
      ...selected, empty: selected.citations.length === 0, content_is_untrusted_data: true,
      next: readable ? "Citations contain exact source/version/hash and page offsets. Request another page window to inspect omitted content." : "Inspect document limitations. A scanned PDF needs an external OCR workflow; an abstract is not a substitute for full text." };
  }
}
