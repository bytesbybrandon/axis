import { setTimeout as delay } from "node:timers/promises";
import { LocalCache, MAX_DOWNLOAD } from "./cache.ts";
import { ResearchError, type Provider } from "./domain.ts";

export type ResponseData = { bytes: string; content_type: string; fetched_at: string; url: string };
export type Fetcher = typeof fetch;
/** Reject unapproved destinations at every hop; PDF paths retain the exact version. Perf: P0; O(url); target CC <= 8, coverage >= 90%, CRAP <= 10. */
export function safeUrl(url: URL, original: URL, provider: Provider) {
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) throw new ResearchError("UNSAFE_URL", "Unsafe provider URL.", provider);
  const hosts = provider === "arxiv" ? ["arxiv.org", "export.arxiv.org"] : ["api.openalex.org"];
  const pdfPath = original.pathname.startsWith("/pdf/") && url.pathname.replace(/\.pdf$/, "") === original.pathname.replace(/\.pdf$/, "");
  const sameRoute = url.pathname === original.pathname;
  if (!hosts.includes(url.hostname) || (!sameRoute && !pdfPath) || url.search !== original.search) throw new ResearchError("UNSAFE_REDIRECT", "Provider redirect changed the constrained destination.", provider);
}
/** Stream until the byte cap, with a deadline that also covers body consumption. Perf: P2; O(cap); target CC <= 15, coverage >= 70%, CRAP <= 25. */
async function bodyBytes(response: Response, cap: number): Promise<Buffer> {
  const length = Number(response.headers.get("content-length"));
  if (length > cap) { await response.body?.cancel(); throw new ResearchError("DOWNLOAD_LIMIT", "Provider response exceeds the byte cap."); }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > cap) throw new ResearchError("DOWNLOAD_LIMIT", "Provider response exceeds the byte cap.");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}
/** Parse a bounded retry delay without printing provider body or request secrets. Perf: P0; O(1); target CC <= 8, coverage >= 90%, CRAP <= 10. */
function retryWait(response: Response): number {
  const value = response.headers.get("retry-after");
  if (!value) return 1_000;
  const seconds = Number(value);
  const wait = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(wait) ? Math.max(0, wait) : 1_000;
}

export class Http {
  readonly cache: LocalCache; private fetcher: Fetcher;
  constructor(cache: LocalCache, fetcher: Fetcher = fetch) { this.cache = cache; this.fetcher = fetcher; }
  /** Serialize both metadata and document requests across local processes, including cache misses and retries. Perf: P2; O(response bytes); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  async get(provider: Provider, url: URL, immutable = false): Promise<ResponseData> {
    const publicUrl = new URL(url); publicUrl.searchParams.delete("api_key");
    const key = `http:v1:${publicUrl.href}`;
    // Keyed queries must not satisfy a later keyless query from a different quota context.
    // Credentials never enter persisted cache keys or values.
    const cacheKey = `${key}:${url.searchParams.has("api_key") ? "opted-in" : "keyless"}`;
    return this.cache.exclusive(`network:${provider}`, async () => {
      const cached = await this.cache.get<ResponseData>(cacheKey);
      if (cached) return cached;
      const data = await this.attempts(provider, url, publicUrl.href);
      await this.cache.put(cacheKey, data, immutable ? null : 86_400_000);
      return data;
    });
  }
  /** One retry; each redirect/retry goes through the same durable request clock. Perf: P2; O(2 * capped bytes); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  private async attempts(provider: Provider, original: URL, publicUrl: string): Promise<ResponseData> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return await this.follow(provider, original, publicUrl, attempt); }
      catch (error) {
        if (error instanceof Retry && attempt === 0) { await delay(error.wait); continue; }
        if (error instanceof ResearchError) throw error;
        if (attempt === 0) { await delay(1_000); continue; }
        throw new ResearchError("NETWORK", `${provider} request failed or timed out.`, provider, "Check provider availability; retry the same command.");
      }
    }
    throw new ResearchError("UPSTREAM", `${provider} retry failed.`, provider);
  }
  /** Consume/close each response before advancing, preserving the one-connection invariant. Perf: P2; O(hops * capped bytes); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  private async follow(provider: Provider, original: URL, publicUrl: string, attempt: number): Promise<ResponseData> {
    let target = original;
    for (let hop = 0; hop <= 3; hop++) {
      safeUrl(target, original, provider);
      await this.space(provider);
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await this.fetcher(target, { redirect: "manual", signal: controller.signal,
          headers: { connection: "close", "user-agent": "research-axi/0.1.0 (local retrieval; https://github.com/bytesbybrandon/axis)", accept: original.pathname.startsWith("/pdf/") ? "application/pdf" : "application/atom+xml, application/json" } });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          await response.body?.cancel();
          const location = response.headers.get("location");
          if (!location || hop === 3) throw new ResearchError("UNSAFE_REDIRECT", "Missing or excessive provider redirects.", provider);
          target = new URL(location, target); continue;
        }
        if (!response.ok) { await response.body?.cancel(); this.statusError(provider, response, attempt); }
        const cap = original.pathname.startsWith("/pdf/") ? MAX_DOWNLOAD : 2 * 1024 * 1024;
        const bytes = await bodyBytes(response, cap);
        return { bytes: bytes.toString("base64"), content_type: response.headers.get("content-type") ?? "", fetched_at: new Date().toISOString(), url: publicUrl };
      } finally {
        clearTimeout(timeout);
        // Anchor the next request after this attempt has finished. Slow fsync or
        // request preparation must never shorten spacing between actual starts.
        await this.cache.put(`clock:${provider}`, Date.now());
      }
    }
    throw new ResearchError("UNSAFE_REDIRECT", "Too many redirects.", provider);
  }
  /** Durable spacing before every attempt; called only under the network lock. Perf: P2; O(1); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  private async space(provider: Provider) {
    const interval = provider === "arxiv" ? 3100 : 150;
    const last = await this.cache.get<number>(`clock:${provider}`);
    if (last !== null) await delay(Math.max(0, last + interval - Date.now()));
    await this.cache.put(`clock:${provider}`, Date.now());
  }
  /** Return provider-specific failures, never an empty search. Perf: P0; O(1); target CC <= 8, coverage >= 90%, CRAP <= 10. */
  private statusError(provider: Provider, response: Response, attempt: number): never {
    const status = response.status, wait = retryWait(response);
    if ((status === 429 || status >= 500) && attempt === 0 && wait <= 30_000) throw new Retry(wait);
    const code = status === 401 || status === 403 ? "AUTH" : status === 429 ? "RATE_LIMIT" : status === 404 ? "NOT_FOUND" : "UPSTREAM";
    throw new ResearchError(code, `${provider} returned HTTP ${status}.`, provider, "Check provider access/status; do not interpret this as no matching papers.");
  }
}
class Retry extends Error { readonly wait: number; constructor(wait: number) { super("retry"); this.wait = wait; } }
