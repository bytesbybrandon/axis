import { Research, type Args } from "./application.ts";
import { ResearchError, arxivId, paperId } from "./domain.ts";

export type Param = { type: "string" | "integer" | "boolean"; description: string; required?: boolean; positional?: boolean;
  default?: string | number | boolean; minimum?: number; maximum?: number; enum?: string[]; maxLength?: number };
export type Operation = { command: string; tool: string; description: string; params: Record<string, Param>; run: (app: Research, args: Args) => Promise<unknown> };
const credit: Param = { type: "boolean", default: false, description: "Explicit acknowledgement: use OPENALEX_API_KEY and potentially consume purchased credits. Default false uses keyless access even when a key is configured." };
const source: Param = { type: "string", required: true, positional: true, maxLength: 4096, description: "arXiv ID (prefer explicit vN) or local:<PDF path>. OpenAlex records are discovery-only." };
const window = {
  source,
  "from-page": { type: "integer", default: 1, minimum: 1, maximum: 100_000, description: "First PDF page, 1-based." } as Param,
  "to-page": { type: "integer", default: 10, minimum: 1, maximum: 100_000, description: "Last PDF page inclusive; at most 100 pages per call (default 10)." } as Param,
  "max-characters": { type: "integer", default: 8000, minimum: 1, maximum: 20_000, description: "Maximum returned passage characters; default 8000, maximum 20000." } as Param,
};
export const operations: Operation[] = [
  { command: "home", tool: "research_home", description: "Inspect local cached discovery summaries without network access.", params: {}, run: (app) => app.cache.home() },
  { command: "search", tool: "research_search", description: "Search one bounded provider page; both returns explicit provider errors/partial status. Abstracts are not full papers.", params: {
    query: { type: "string", required: true, positional: true, maxLength: 2000, description: "Search phrase, or native arXiv expression with --native true." },
    provider: { type: "string", required: true, enum: ["arxiv", "openalex", "both"], description: "Explicit discovery provider; no silent fallback." },
    limit: { type: "integer", default: 10, minimum: 1, maximum: 50, description: "Maximum results per provider, 1-50." },
    native: { type: "boolean", default: false, description: "Use exact native arXiv query syntax; requires provider arxiv." },
    "arxiv-cursor": { type: "string", maxLength: 5, description: "Offset from the previous arXiv page." },
    "openalex-cursor": { type: "string", maxLength: 4096, description: "Opaque next cursor from OpenAlex. Paging beyond first page requires explicit keyed credit opt-in." },
    "allow-credit-use": credit,
  }, run: (app, args) => app.search(args) },
  { command: "get", tool: "research_get", description: "Get metadata by arxiv:<ID> or openalex:W<ID>, including resolved arXiv version and publication links.", params: {
    id: { type: "string", required: true, positional: true, maxLength: 100, description: "Supported provider ID, such as arxiv:2501.13956v1 or openalex:W2741809807." },
    "allow-credit-use": credit,
  }, run: (app, args) => app.get(args) },
  { command: "read", tool: "research_read", description: "Read bounded PDF pages with structured exact citations; explicitly report scanned/extraction limitations and omitted text.", params: window, run: (app, args) => app.read(args) },
  { command: "find", tool: "research_find", description: "Find literal, case-sensitive passages within a bounded PDF page window, returning exact citations and omitted matches.", params: {
    ...window, "to-page": { ...window["to-page"], default: 100 },
    query: { type: "string", required: true, positional: true, maxLength: 200, description: "Literal, case-sensitive passage text; no regular expressions." },
    limit: { type: "integer", default: 10, minimum: 1, maximum: 50, description: "Maximum cited matches." },
  }, run: (app, args) => app.read(args, true) },
  { command: "cite", tool: "research_cite", description: "Obtain an exact structured citation by PDF page and UTF-16 start/end offsets from read/find. No model-generated references.", params: {
    source, page: { type: "integer", required: true, minimum: 1, maximum: 100_000, description: "PDF page from a read/find locator." },
    start: { type: "integer", required: true, minimum: 0, maximum: 2_000_000, description: "Inclusive page-text UTF-16 offset." },
    end: { type: "integer", required: true, minimum: 1, maximum: 2_000_000, description: "Exclusive page-text UTF-16 offset; at most 20000 characters." },
  }, run: (app, args) => app.cite(args) },
];
/** Validate transport-neutral types, defaults, bounds and semantic combinations. Perf: P0; O(parameters); target CC <= 8 per helper, coverage >= 90%, CRAP <= 10. */
export function validate(operation: Operation, raw: unknown): Args {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new ResearchError("INVALID_ARGUMENT", "Arguments must be an object.");
  const input = raw as Record<string, unknown>, out: Args = {};
  for (const key of Object.keys(input)) if (!Object.hasOwn(operation.params, key)) throw new ResearchError("INVALID_ARGUMENT", `Unknown argument ${key}.`);
  for (const [name, param] of Object.entries(operation.params)) {
    const value = input[name] === undefined ? param.default : input[name];
    if (value === undefined) { if (param.required) throw new ResearchError("MISSING_ARGUMENT", `${name} is required.`); continue; }
    out[name] = validateValue(name, param, value);
  }
  semantics(operation.command, out);
  return out;
}
/** Validate one scalar identically for CLI and MCP. Perf: P0; O(value length); target CC <= 8, coverage >= 90%, CRAP <= 10. */
function validateValue(name: string, param: Param, value: unknown): string | number | boolean {
  if (param.type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < param.minimum! || value > param.maximum!) throw new ResearchError("INVALID_ARGUMENT", `${name} must be an integer from ${param.minimum} to ${param.maximum}.`);
    return value;
  }
  if (param.type === "boolean") {
    if (typeof value !== "boolean") throw new ResearchError("INVALID_ARGUMENT", `${name} must be true or false.`);
    return value;
  }
  if (typeof value !== "string" || !value.trim() || value.length > (param.maxLength ?? 2000) || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value) || (param.enum && !param.enum.includes(value))) throw new ResearchError("INVALID_ARGUMENT", `${name} must be a nonempty supported string within its length limit.`);
  return value;
}
/** Check cross-field invariants through small domain validators. Perf: P0; O(source length); target CC <= 8, coverage >= 90%, CRAP <= 10. */
function semantics(command: string, args: Args) {
  if (command === "search") searchSemantics(args);
  if (command === "get") paperId(String(args.id));
  if (args.source !== undefined) sourceSemantics(String(args.source));
  if (args["from-page"] !== undefined) windowSemantics(Number(args["from-page"]), Number(args["to-page"]));
  if (command === "find" && Number(args["max-characters"]) < String(args.query).length) throw new ResearchError("INVALID_ARGUMENT", "max-characters must accommodate the search text.");
  if (command === "cite") locatorSemantics(Number(args.start), Number(args.end));
}
/** Match options to selected discovery providers. Perf: P0; O(1); target CC <= 8, coverage >= 90%, CRAP <= 10. */
function searchSemantics(args: Args) {
  if (args.native && args.provider !== "arxiv") throw new ResearchError("INVALID_ARGUMENT", "Native queries require --provider arxiv.");
  if (args.provider === "openalex" && args["arxiv-cursor"] !== undefined) throw new ResearchError("INVALID_ARGUMENT", "arxiv cursor requires an arxiv provider.");
  if (args.provider === "arxiv" && args["openalex-cursor"] !== undefined) throw new ResearchError("INVALID_ARGUMENT", "openalex cursor requires an openalex provider.");
}
/** Explicit local files or supported arXiv IDs only. Perf: P0; O(source); target CC <= 8, coverage >= 90%, CRAP <= 10. */
function sourceSemantics(source: string) {
  if (!source.startsWith("local:")) arxivId(source);
  else if (!source.slice(6).trim()) throw new ResearchError("INVALID_ARGUMENT", "local: requires a PDF path.");
}
/** Keep extraction window ordered and capped. Perf: P0; O(1); target CC <= 8, coverage >= 90%, CRAP <= 10. */
function windowSemantics(from: number, to: number) {
  if (to < from || to - from >= 100) throw new ResearchError("INVALID_ARGUMENT", "Use an ordered page window of at most 100 pages.");
}
/** Keep a single citation's slice positive and bounded. Perf: P0; O(1); target CC <= 8, coverage >= 90%, CRAP <= 10. */
function locatorSemantics(start: number, end: number) {
  if (end <= start || end - start > 20_000) throw new ResearchError("INVALID_ARGUMENT", "Citation end must exceed start by at most 20000 characters.");
}
/** CLI converts scalars before invoking the exact MCP/application validation. Perf: P0; O(argv); target CC <= 8 per helper, coverage >= 90%, CRAP <= 10. */
export function parseArgs(operation: Operation, args: string[]): Record<string, unknown> {
  const raw: Record<string, unknown> = {}, positional = Object.entries(operation.params).filter(([, p]) => p.positional).map(([key]) => key);
  for (let i = 0; i < args.length; i++) {
    const flag = args[i].startsWith("--"); const key = flag ? args[i].slice(2) : positional.shift();
    if (!key || !Object.hasOwn(operation.params, key) || (flag && args[i + 1] === undefined) || raw[key] !== undefined) throw new ResearchError("INVALID_ARGUMENT", "Unknown, duplicate or incomplete argument.");
    const value = flag ? args[++i] : args[i], type = operation.params[key].type;
    raw[key] = type === "integer" && /^\d+$/.test(value) ? Number(value) : type === "boolean" && /^(true|false)$/.test(value) ? value === "true" : value;
  }
  return raw;
}
/** Derive JSON Schema from the same parameter bounds used by CLI. Perf: P0; O(parameters); target CC <= 8, coverage >= 90%, CRAP <= 10. */
export function toolDefinition(op: Operation) {
  return { name: op.tool, description: op.description, inputSchema: { type: "object", additionalProperties: false,
    properties: Object.fromEntries(Object.entries(op.params).map(([name, p]) => {
      const { positional: _positional, required: _required, ...schema } = p;
      return [name, schema];
    })), required: Object.entries(op.params).filter(([, p]) => p.required).map(([key]) => key) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true } };
}
