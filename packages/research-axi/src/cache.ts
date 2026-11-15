import { open, mkdir, rename, unlink, lstat } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { hash, ResearchError } from "./domain.ts";

export const MAX_DOWNLOAD = 20 * 1024 * 1024;
export const CACHE_LIMIT = 32 * 1024 * 1024;
/** Bounded regular-file read, including files that grow during access. Perf: P2; O(cap); target CC <= 15, coverage >= 70%, CRAP <= 25. */
export async function boundedFile(path: string, cap: number): Promise<Buffer> {
  const before = await lstat(path);
  if (!before.isFile() || before.size > cap) throw new ResearchError("FILE_LIMIT", "Expected a regular file within the byte limit (symlinks are not accepted).");
  const fd = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const stat = await fd.stat();
    if (!stat.isFile() || stat.size > cap) throw new ResearchError("FILE_LIMIT", "Expected a regular file within the byte limit.");
    const chunks: Buffer[] = []; let size = 0;
    while (true) {
      const buffer = Buffer.alloc(Math.min(64 * 1024, cap + 1 - size));
      const { bytesRead } = await fd.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      size += bytesRead;
      if (size > cap) throw new ResearchError("FILE_LIMIT", "File exceeded the byte limit.");
      chunks.push(buffer.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks);
  } finally { await fd.close(); }
}

export class LocalCache {
  readonly root: string;
  constructor(root = process.env.RESEARCH_AXI_CACHE ?? join(homedir(), ".cache", "research-axi")) { this.root = resolve(root); }
  /** Address one cache entry. Perf: P0; O(key); target CC <= 8, coverage >= 90%, CRAP <= 10. */
  path(key: string) { return join(this.root, `${hash(key)}.json`); }
  /** Read bounded local state; expired entries miss, corrupt entries fail explicitly. Perf: P1; O(entry bytes); target CC <= 12, coverage >= 80%, CRAP <= 15. */
  async get<T>(key: string): Promise<T | null> {
    try {
      const record = JSON.parse((await boundedFile(this.path(key), CACHE_LIMIT)).toString());
      if (!record || !("value" in record) || (record.expires !== null && !Number.isFinite(record.expires))) throw new Error("Invalid cache envelope");
      return record.expires !== null && record.expires <= Date.now() ? null : record.value as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new ResearchError("CACHE_READ", "Cached state is unreadable; use a fresh RESEARCH_AXI_CACHE directory.");
    }
  }
  /** Atomic publication with owner-only permissions. Perf: P2; O(entry bytes); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  async put(key: string, value: unknown, ttl: number | null = null) {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const path = this.path(key), temporary = `${path}.${randomUUID()}.tmp`;
    const data = JSON.stringify({ expires: ttl === null ? null : Date.now() + ttl, value });
    if (Buffer.byteLength(data) > CACHE_LIMIT) throw new ResearchError("CACHE_LIMIT", "Normalized document exceeds the cache byte cap.");
    const fd = await open(temporary, "wx", 0o600);
    try { await fd.writeFile(data); await fd.sync(); } finally { await fd.close(); }
    try { await rename(temporary, path); } finally { await unlink(temporary).catch(() => {}); }
  }
  /** Cross-process exclusion. Locks are never stolen while a process may still own a connection. Perf: P2; O(wait/50ms); target CC <= 15, coverage >= 70%, CRAP <= 25. */
  async exclusive<T>(name: string, run: () => Promise<T>, timeout = 120_000): Promise<T> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const lock = join(this.root, `${hash(name)}.lock`), deadline = Date.now() + timeout;
    let fd;
    while (!fd) {
      try { fd = await open(lock, "wx", 0o600); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new ResearchError("CACHE_LOCK", "Could not acquire local request lock.");
        if (Date.now() >= deadline) throw new ResearchError("CACHE_BUSY", "Cache request lock timed out; if an owner crashed, verify all clients are stopped before removing .lock files.");
        await delay(50);
      }
    }
    try { await fd.writeFile(String(process.pid)); return await run(); }
    finally { await fd.close(); await unlink(lock); }
  }
  /** Content-first local summaries, bounded independently of total cache size. Perf: P1; O(20 summaries); target CC <= 12, coverage >= 80%, CRAP <= 15. */
  async home() {
    const papers = await this.get<unknown[]>("home-index") ?? [];
    return { status: "ok", cache: this.root, papers, empty: papers.length === 0, listing_limit: 20, next_step: "Search one explicit provider or read a pinned arXiv paper.",
      openalex_mode: "keyless unless explicit credit-use acknowledgement", next: "research-axi search \"concept\" --provider arxiv --limit 5" };
  }
}
