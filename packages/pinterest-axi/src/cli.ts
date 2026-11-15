import { runAxiCli } from "axi-sdk-js";
import { serveMcp } from "./mcp.ts";
import { type Operation, operations, validate } from "./operations.ts";
import { PinterestError, TOKEN_VARIABLE, createClient } from "./pinterest.ts";
import { VERSION } from "./version.ts";

type AxiRenderable = Awaited<ReturnType<NonNullable<Parameters<typeof runAxiCli>[0]["commands"]>[string]>>;

/** Splits argv into positionals and --flag values. O(n). CC 5. */
export function parseArgs(operation: Operation, args: string[]): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  const positionals = Object.entries(operation.params).filter(([, p]) => p.positional).map(([name]) => name);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      if (!(name in operation.params) || args[i + 1] === undefined) {
        throw new PinterestError("INVALID_ARGUMENT", `Unknown or incomplete flag ${arg}.`);
      }
      raw[name] = args[++i];
    } else {
      const name = positionals.shift();
      if (!name) throw new PinterestError("INVALID_ARGUMENT", `Unexpected argument ${arg}.`);
      raw[name] = arg;
    }
  }
  return raw;
}

function usage(operation: Operation): string {
  const parts = Object.entries(operation.params).map(([name, p]) =>
    p.positional ? `<${name}>` : `[--${name} <${p.type}>]`,
  );
  const details = Object.entries(operation.params).map(([name, p]) => `  ${name}: ${p.description}`);
  return [`${operation.description}`, `Usage: pinterest-axi ${operation.command} ${parts.join(" ")}`.trim(), ...details].join("\n");
}

async function execute(operation: Operation, args: string[]): Promise<AxiRenderable> {
  try {
    const parsed = validate(operation, parseArgs(operation, args));
    return (await operation.run(createClient(), parsed)) as AxiRenderable;
  } catch (error) {
    if (error instanceof PinterestError) return error.toProblem() as AxiRenderable;
    throw error;
  }
}

async function home() {
  const configured = Boolean(process.env[TOKEN_VARIABLE]?.trim());
  return {
    service: "Pinterest (API v5, read-only)",
    token: configured ? "configured" : "missing",
    help: [
      configured ? "Run `pinterest-axi whoami` to confirm the token." : `Set ${TOKEN_VARIABLE} to a Pinterest access token.`,
      "Run `pinterest-axi boards` to list boards, then `pinterest-axi pins <board>`.",
      "Run `pinterest-axi mcp` to serve the same operations as an MCP server over stdio.",
    ],
  };
}

export async function main() {
  const argv = process.argv.slice(2);
  // MCP owns stdout for JSON-RPC, so it bypasses the AXI renderer.
  if (argv[0] === "mcp" && !argv.includes("--help")) {
    await serveMcp();
    return;
  }
  await runAxiCli({
    description: "Read Pinterest boards and pins as an AXI CLI or an MCP server.",
    version: VERSION,
    packageName: "pinterest-axi",
    argv,
    topLevelHelp: [
      "Pinterest AXI",
      "Commands: whoami, boards, pins, pin, search, mcp",
      "Examples:",
      "  pinterest-axi boards --limit 10",
      "  pinterest-axi pins <board> --cursor <next_cursor>",
      "  pinterest-axi search \"kitchen\"",
      "  pinterest-axi mcp   (MCP server over stdio)",
      `Set ${TOKEN_VARIABLE} to a Pinterest access token. Read-only; writes are not supported yet.`,
    ].join("\n"),
    commands: {
      ...Object.fromEntries(operations.map((operation) => [operation.command, (args: string[]) => execute(operation, args)])),
    },
    home,
    getCommandHelp(command) {
      if (command === "mcp") return "Serve the operations as MCP tools over stdio (JSON-RPC). Add to an MCP client as: pinterest-axi mcp";
      const operation = operations.find((candidate) => candidate.command === command);
      return operation ? usage(operation) : undefined;
    },
  });
}
