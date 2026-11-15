// The single operation table shared by the AXI CLI and the MCP server.
// Performance: tier P3 (table lookup + validation), O(p) in parameter count, CRAP target: CC <= 6, branch coverage >= 90%.
import {
  type Client,
  PinterestError,
  getPin,
  listBoards,
  listPins,
  searchPins,
  whoami,
} from "./pinterest.ts";

export interface Param {
  type: "string" | "integer";
  description: string;
  required?: boolean;
  /** CLI form: positional (first free argument) or a --flag named after the parameter. */
  positional?: boolean;
}

export interface Operation {
  /** CLI command name. */
  command: string;
  /** MCP tool name. */
  tool: string;
  description: string;
  params: Record<string, Param>;
  run(client: Client, args: Record<string, unknown>): Promise<unknown>;
}

const limit: Param = { type: "integer", description: "Items per page, 1-250 (default 25)." };
const cursor: Param = { type: "string", description: "next_cursor from the previous page." };

export const operations: Operation[] = [
  {
    command: "whoami",
    tool: "pinterest_whoami",
    description: "Show the Pinterest account the access token belongs to.",
    params: {},
    run: (client) => whoami(client),
  },
  {
    command: "boards",
    tool: "pinterest_list_boards",
    description: "List the account's boards, one page at a time.",
    params: { limit, cursor },
    run: (client, args) => listBoards(client, args),
  },
  {
    command: "pins",
    tool: "pinterest_list_pins",
    description: "List the pins on a board, one page at a time.",
    params: {
      board: { type: "string", description: "Board ID (digits, from `boards`).", required: true, positional: true },
      limit,
      cursor,
    },
    run: (client, args) => listPins(client, args as never),
  },
  {
    command: "pin",
    tool: "pinterest_get_pin",
    description: "Get one pin by ID.",
    params: { pin: { type: "string", description: "Pin ID (digits).", required: true, positional: true } },
    run: (client, args) => getPin(client, args as never),
  },
  {
    command: "search",
    tool: "pinterest_search_pins",
    description: "Search the account's own pins by keyword or comma-separated pin IDs.",
    params: {
      query: { type: "string", description: "Keywords or comma-separated pin IDs.", required: true, positional: true },
      cursor,
    },
    run: (client, args) => searchPins(client, args as never),
  },
];

const ID_PARAMS = new Set(["board", "pin"]);

/** Validates raw arguments against an operation's params and returns typed values. O(p). CC 9. */
export function validate(operation: Operation, raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, param] of Object.entries(operation.params)) {
    const value = raw[name];
    if (value === undefined || value === "") {
      if (param.required) throw new PinterestError("MISSING_ARGUMENT", `${name} is required.`);
      continue;
    }
    if (param.type === "integer") {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1 || number > 250) {
        throw new PinterestError("INVALID_ARGUMENT", `${name} must be an integer from 1 to 250.`);
      }
      out[name] = number;
    } else {
      const text = String(value).trim();
      if (ID_PARAMS.has(name) && !/^\d+$/.test(text)) {
        throw new PinterestError("INVALID_ARGUMENT", `${name} must be a numeric ID.`);
      }
      out[name] = text;
    }
  }
  return out;
}
