import { spawnSync } from "node:child_process";

const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

export function normalizeListData(data: unknown) {
  const listData = (items: unknown[]) => ({
    items,
    count: items.length,
    message: items.length === 0 ? "0 items found" : `${items.length} items found`,
  });

  if (Array.isArray(data)) {
    return listData(data);
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const entry = Object.entries(record).find(([, value]) => Array.isArray(value));
    if (entry) {
      const [key, value] = entry as [string, unknown[]];
      return {
        ...record,
        [key]: value,
        ...listData(value),
      };
    }
  }

  return data;
}

export function runHoncho(args: string[]) {
  const executable = process.env.HONCHO_BIN || "honcho";
  const result = spawnSync(executable, args, {
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
    timeout: 30_000,
    windowsHide: true,
  });

  if (result.error) {
    const notFound = (result.error as NodeJS.ErrnoException).code === "ENOENT";
    return {
      ok: false,
      code: notFound ? "HONCHO_CLI_NOT_FOUND" : "HONCHO_CLI_FAILED",
      message: notFound
        ? "Honcho CLI was not found. Install honcho-cli and run honcho init."
        : result.error.message,
    };
  }

  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  let data: unknown;

  if (stdout) {
    try {
      data = JSON.parse(stdout);
    } catch {
      data = stdout;
    }
  }

  if (result.status === 0 && args[1] === "list") {
    data = normalizeListData(data ?? []);
  }

  return {
    ok: result.status === 0,
    exit_code: result.status ?? 1,
    ...(data === undefined ? {} : { data }),
    ...(stderr ? { stderr } : {}),
    ...(result.signal ? { signal: result.signal } : {}),
  };
}
