# research-axi

Private, local-first literature retrieval through an AXI CLI and MCP over stdio. Uses arXiv and OpenAlex for discovery, a shared application core for both interfaces, and `unpdf` (Mozilla PDF.js) for bounded PDF text extraction. There are no model calls, embeddings, research conclusions or Mnemo writes. Publication is separate from this private implementation.

Requires Node.js 22.18+ and pnpm 11 in this workspace. Build locally:

```sh
pnpm --filter research-axi build
pnpm --filter research-axi build:runtime
node packages/research-axi/bin/research-axi.js --help
```

Use `research-axi` below for the local executable. Bare invocation shows up to 20 cached paper summaries, cache location and a next command without network access.

```sh
research-axi search "causal representation" --provider arxiv --limit 5
research-axi search 'ti:attention AND cat:cs.LG' --provider arxiv --native true
research-axi search "causal representation" --provider both --limit 5 --json
research-axi search "causal representation" --provider arxiv --arxiv-cursor 5
research-axi get arxiv:2501.13956v1 --json
research-axi get openalex:W2741809807 --full
research-axi read arxiv:2501.13956v1 --from-page 2 --to-page 4 --max-characters 6000
research-axi find arxiv:2501.13956v1 "method" --from-page 1 --to-page 20
research-axi read local:/absolute/path/paper.pdf --from-page 1 --to-page 3 --json
research-axi cite arxiv:2501.13956v1 --page 2 --start 0 --end 100 --json
```

Search requires `--provider arxiv|openalex|both`. Normal queries are a quoted arXiv `all:` phrase; native mode passes arXiv syntax unchanged and requires provider `arxiv`. Search returns at most 50 results per provider (10 default); it never fetches the next page automatically. Use the returned `paging.arxiv.next` offset or `paging.openalex.next` opaque cursor. The arXiv offset is bounded to 10000. IDs accept modern and legacy arXiv IDs, with optional `arxiv:` prefix, or `openalex:W<digits>`/`W<digits>` for metadata. Arbitrary URLs and DOI inputs are not accepted. Unversioned arXiv metadata/document requests resolve to an explicit version before PDF retrieval; supplying `vN` avoids a latest-version metadata lookup.

Default CLI output is TOON with four-field search rows: `id,title,published,source`. `--json` exposes the full result, `--full` exposes full TOON, and `--fields id,title,version,links` projects paper metadata. Flags follow the command; booleans take explicit `true` or `false`. `get` labels abstracts as discovery text and includes publication links. OpenAlex work IDs have no asserted full-text version; their abstracts are never treated as complete papers, and their links are not downloaded. `read/find/cite` work on arXiv PDFs or explicit local PDFs only.

An empty successful search has `status: ok`, `empty: true` and `papers: []`. Failed providers return structured errors; `both` returns `status: partial` when one succeeds, including the failed provider's error. All-provider failure is `status: error`, not an empty literature result. CLI exits are 0 for success/limited extraction, 1 for operation errors, 2 for unknown commands/top-level flags, and 3 for partial search results. MCP includes the same status/errors in structured content and marks failed tool calls `isError`.

## Passage fidelity and bounds

`read` returns exact extracted page slices as structured `citations`. `find` searches a specified page window literally and case-sensitively (no regex), returning up to 10 cited matches by default, maximum 50. `cite` directly retrieves an exact slice using a page and UTF-16 start/end offsets obtained from read/find. Citations include source ID, exact arXiv version or local content version, source URL, SHA-256 of original PDF bytes, original fetch time, extractor/version, page locator and exact text. Local source identity is the content hash; the URL identifies the requested file. To cite a local file later, pass its `local:<path>` source again; its hash must still match your earlier result.

Every read/find/cite result includes document identity, extraction bounds, omitted page counts, truncation, output bounds and limitations. Page locators are 1-based PDF pages, which can differ from printed page labels. Offsets index the adapter's extracted page text, not PDF byte offsets. Section names are not inferred; PDF page/offset locators remain available. PDF text order, equations and tables can differ from their visual layout. Validate important quotations against the rendered version.

Default read pages are 1–10; find pages are 1–100. A call may extract at most 100 pages and 2 million characters, returning at most 20000 characters (8000 default). Omitted counts refer to the chosen window/document; a find with no matches does not prove absence outside its scanned window. Blank/scanned pages and password/parser/resource failures return explicit limitations. No OCR, HTML fallback, abstract substitution or invented text is provided. The original PDF hash and fetch time remain available even when extraction fails. Parser work runs in a child process with a 256 MiB JS heap, bounded output and 30-second wall timeout. Native/parser overhead can add memory beyond the JS heap.

Paper text is untrusted data, never instructions or executable code. The tool does not execute embedded scripts, source archives or paper-supplied commands. It downloads only constrained HTTPS provider endpoints and validates every redirect; PDF responses must have PDF MIME/signature. Downloads cap at 20 MiB; metadata caps at 2 MiB. Each request/body read has a 30-second deadline, at most one retry and three redirect hops. A retry-after wait over 30 seconds returns a provider error. Local reads require regular files, reject symlinks and cap bytes too.

## Local cache and request coordination

`RESEARCH_AXI_CACHE` selects the cache; default is `~/.cache/research-axi`. CLI and MCP must use the same directory to share immutable version-pinned PDFs/extractions and normalized metadata. Latest/search metadata expires after 24 hours; pinned document entries remain until removed. Local PDFs are reread and hashed to detect edits, then reuse extraction by content hash and page window. Disk cache growth is manual: stop clients before deleting entries. The tool writes only its local cache, never the original PDFs.

Atomic file locks serialize provider requests across concurrent processes sharing the cache, including redirects, body consumption and retries. arXiv uses one connection, with at least 3.1 seconds between request starts. A lock waits at most 120 seconds. Locks left by a crashed process are not automatically stolen; confirm every owner is stopped before removing `.lock` files. Use a local filesystem with reliable exclusive-create and rename semantics.

**PC and Mac clients must not fetch arXiv independently.** [arXiv's terms](https://info.arxiv.org/help/api/tou.html) apply across all machines under the same operator. This local lock coordinates one shared local cache, not independent hosts or unrelated tools. Run upstream retrieval on one designated machine, or coordinate all access externally. Do not run another arXiv client concurrently with the live verification commands.

## OpenAlex access and credits

Checked 2026-11-15 against [OpenAlex authentication](https://help.openalex.org/api/authentication/): basic access permits keyless queries; cursor paging beyond page one requires a key. The tool defaults to keyless access even if `OPENALEX_API_KEY` exists. Missing, rejected or rate-limited credentials never silently fall back to an empty search.

If you explicitly pass `--allow-credit-use true` (MCP argument `allow-credit-use: true`), the tool uses `OPENALEX_API_KEY`, acknowledging that upstream may consume purchased credits after its free budget. A configured key alone does not authorize that use. This is not a guaranteed free-only keyed mode: [OpenAlex documents automatic prepaid drawdown](https://help.openalex.org/access/buying-and-renewing/) and no reliable free-only request control was established. The tool never buys credits, creates accounts, activates keys or configures billing. Keys are not persisted in cache records, printed or included in errors. A provider 429 is an error after the bounded retry; it does not enable paid access. Keyed behavior has deterministic tests; no keyed live calls are part of this build's proof.

## MCP

```json
{ "mcpServers": { "research": { "command": "research-axi", "args": ["mcp"], "env": { "RESEARCH_AXI_CACHE": "/absolute/local/cache" } } } }
```

The stdio server exposes `research_home`, `research_search`, `research_get`, `research_read`, `research_find`, and `research_cite`. `tools/list` derives JSON Schemas from the same validation table used by CLI. Results include TOON text and full `structuredContent`; citations are structured objects in both. No listening port or daemon. Input is bounded to a 1 MiB buffer; operations execute serially within a server, and provider locks coordinate other local processes. OpenAlex credit opt-in uses the boolean tool argument named `allow-credit-use`.

## Development and verification

One application core owns retrieval/citations. Provider adapters and extraction are infrastructure ports; CLI/MCP are thin transports. See [performance standards](../../PERFORMANCE-STANDARDS.md). The local file cache needs no database service; no existing ByteQuilt cache interface was required for these bounded filesystem records/locks.

After implementation:

```sh
pnpm --filter research-axi build
pnpm --filter research-axi build:runtime
pnpm --filter research-axi test
pnpm --filter research-axi verify:package
```

Deterministic fixtures exercise versions, pagination, metadata/full-text separation, citations/bounds, extraction limitations, concurrent-process spacing and cache reuse, provider failures, unsafe downloads and CLI/MCP parity. The package verifier installs the actual tarball into a temporary consumer, then invokes its CLI and MCP initialize/tools/list/tools/call flow with a generated local PDF. Tests do not require credentials. Small live checks are reported separately; deterministic tests are not claimed as live-provider proof.

Provider mappings were informed by the read-only `ip-search-mcp` adapters (Brandon D. Phillips, MIT) and reimplemented for the stricter contracts here. That project is neither modified nor a runtime dependency. Dependencies retain their own licenses, including unpdf/Mozilla PDF.js.
