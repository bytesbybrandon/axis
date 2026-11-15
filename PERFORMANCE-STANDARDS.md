# Performance standards

New research-axi operations use bounded work and explicit upstream waits. These budgets apply to the new package; existing packages retain their current contracts.

| Tier | Budget | Operations | Complexity and risk target |
| --- | --- | --- | --- |
| P0 | 200 ms local work | Argument validation, operation lookup | O(parameters), CC <= 8, branch coverage target >= 90%, CRAP <= 10 |
| P1 | 2 s local work | Local home and bounded cache lookup | O(returned entries), CC <= 12, coverage target >= 80%, CRAP <= 15 |
| P2 | 30 s extraction; 30 s per HTTP attempt | Search, metadata, PDF read/find/citations | O(bounded bytes + selected page text), CC <= 15, coverage target >= 70%, CRAP <= 25 |

Requests may additionally wait up to 120 s for the cross-process provider lock. arXiv starts are spaced by at least 3.1 s, with one connection held through body consumption. There are at most two HTTP attempts and three redirect hops; retry-after waits above 30 s return an explicit error. No operation auto-pages through literature results. Search returns at most 50 items per provider. Downloads cap at 20 MiB and metadata at 2 MiB. Extraction caps at 100 selected pages and 2 million extracted characters, runs in a child process with a 256 MiB JS heap and 30 s deadline, and reports omitted content. Output caps at 20,000 characters per call.

Cache JSON is indexed by a SHA-256 key, read with a byte cap and atomically renamed. Normalized search/latest metadata expires after 24 hours; pinned metadata/documents are immutable cache entries. Home reads at most 20 directory entries, rather than scanning every cached document. Cache directories are trusted local state; use one directory per operator and do not use a network share with unreliable filesystem locking. Local PDFs are regular files with a byte cap and content hash. No full database or embedding index is needed.

Annotate nontrivial production functions with `Perf: P2; O(n) ...; target CC <= 15, branch coverage >= 70%, CRAP <= 25.` P0/P1 use the corresponding targets. Targets are budgets, not claims of measured coverage. Global CC/CRAP ceiling is 30; split methods above that. CRAP = CC² × (1 - branch coverage)³ + CC.

Review examples:

```ts
// Good: read one bounded provider page, expose next cursor.
await provider.search({ limit: 10, cursor });
// Bad: fetch every search page before returning.
```

```ts
// Good: recheck cache under the process lock before fetching.
await cache.exclusive(provider, async () => cache.get(key) ?? fetchPage());
// Bad: a separate in-memory limiter in each CLI process.
```

```ts
// Good: count streamed bytes and cancel once the cap is reached.
// Bad: response.arrayBuffer() on an unbounded response.
```

Before implementation choose bounds and a tier. After implementation verify truncation, cache reuse, multi-process spacing and body serialization with deterministic fixtures; exercise packed transports. Run focused package tests/build/tarball smoke after implementation, fixing any failures within scope. Do not claim latency, coverage or CRAP measurements that were not collected. Reject unbounded redirects, automatic pagination, parser execution of paper content and unlimited stdio buffering.
