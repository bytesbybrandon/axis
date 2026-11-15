// Minimal MCP server over stdio (newline-delimited JSON-RPC 2.0): tools only, no extra dependency.
// Performance: tier P2 (I/O bound), O(1) per message, CRAP target: CC <= 8, branch coverage >= 90%.
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import { encode } from "@toon-format/toon";
import { type Client, PinterestError, createClient } from "./pinterest.ts";
import { type Operation, operations, validate } from "./operations.ts";
import { VERSION } from "./version.ts";

const PROTOCOL_VERSION = "2025-06-18";

type Message = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

export function toolDefinition(operation: Operation) {
  const properties = Object.fromEntries(
    Object.entries(operation.params).map(([name, p]) => [name, { type: p.type, description: p.description }]),
  );
  const required = Object.entries(operation.params).filter(([, p]) => p.required).map(([name]) => name);
  return {
    name: operation.tool,
    description: operation.description,
    inputSchema: { type: "object", properties, ...(required.length ? { required } : {}) },
    annotations: { readOnlyHint: true, openWorldHint: true },
  };
}

/** Runs one tool call; failures become isError results, never thrown. O(1). CC 4. */
export async function callTool(getClient: () => Client, name: unknown, args: unknown) {
  const text = (value: unknown, isError = false) => ({ content: [{ type: "text", text: encode(value as never) }], isError });
  const operation = operations.find((candidate) => candidate.tool === name);
  if (!operation) return text({ error: `Unknown tool ${String(name)}.`, code: "UNKNOWN_TOOL" }, true);
  try {
    const parsed = validate(operation, (args ?? {}) as Record<string, unknown>);
    return text(await operation.run(getClient(), parsed));
  } catch (error) {
    if (error instanceof PinterestError) return text(error.toProblem(), true);
    throw error;
  }
}

/** Handles one JSON-RPC message; returns undefined for notifications. O(1). CC 8. */
export async function handle(message: Message, getClient: () => Client) {
  const { id, method, params } = message;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
  const fail = (code: number, text: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message: text } });
  if (id === undefined) return undefined; // notification (for example notifications/initialized)
  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: typeof params?.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "pinterest-axi", version: VERSION },
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: operations.map(toolDefinition) });
    case "tools/call":
      return ok(await callTool(getClient, params?.name, params?.arguments));
    default:
      return fail(-32601, `Method not found: ${String(method)}`);
  }
}

/** Serves MCP until the input closes. The client is created lazily so `tools/list` works without a token. */
export async function serveMcp(
  input: Readable = process.stdin,
  output: Writable = process.stdout,
  getClient: () => Client = () => createClient(),
) {
  const send = (value: unknown) => output.write(`${JSON.stringify(value)}\n`);
  const pending: Promise<unknown>[] = [];
  for await (const line of createInterface({ input })) {
    if (!line.trim()) continue;
    let message: Message;
    try {
      message = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    pending.push(
      handle(message, getClient)
        .then((reply) => { if (reply) send(reply); })
        .catch((error) => send({ jsonrpc: "2.0", id: message.id ?? null, error: { code: -32603, message: (error as Error).message } })),
    );
  }
  await Promise.all(pending);
}
