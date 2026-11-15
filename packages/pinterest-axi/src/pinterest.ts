// Pinterest API v5 client (read-only). Endpoints: https://developers.pinterest.com/docs/api/v5/
// Performance: tier P2 (I/O bound), O(1) per request, CRAP target: CC <= 8, branch coverage >= 90%.

export const TOKEN_VARIABLE = "PINTEREST_ACCESS_TOKEN";
export const BASE_VARIABLE = "PINTEREST_API_BASE";
const DEFAULT_BASE = "https://api.pinterest.com/v5";

export type Problem = { error: string; code: string; help?: string[] };

export class PinterestError extends Error {
  code: string;
  help: string[];

  constructor(code: string, message: string, help: string[] = []) {
    super(message);
    this.code = code;
    this.help = help;
  }

  toProblem(): Problem {
    return { error: this.message, code: this.code, ...(this.help.length ? { help: this.help } : {}) };
  }
}

type Json = Record<string, unknown>;
export type Query = Record<string, string | number | undefined>;

export interface Client {
  get(path: string, query?: Query): Promise<Json>;
}

export interface ClientOptions {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
}

/** Builds a client from the environment. The token is read once and never echoed in errors. O(1). CC 3. */
export function createClient({ env = process.env, fetch: fetchImpl = fetch }: ClientOptions = {}): Client {
  const token = env[TOKEN_VARIABLE]?.trim();
  if (!token) {
    throw new PinterestError("TOKEN_REQUIRED", `Set ${TOKEN_VARIABLE} to a Pinterest API access token.`, [
      "Create one at https://developers.pinterest.com/apps/ (generate access token, read scopes).",
    ]);
  }
  const base = (env[BASE_VARIABLE]?.trim() || DEFAULT_BASE).replace(/\/+$/, "");

  return {
    async get(path, query = {}) {
      const url = new URL(`${base}${path}`);
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
      }
      let response: Response;
      try {
        response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      } catch (cause) {
        throw new PinterestError("NETWORK_ERROR", `Could not reach Pinterest: ${(cause as Error).message}`);
      }
      const body = (await response.json().catch(() => ({}))) as Json;
      if (!response.ok) throw httpError(response.status, body);
      return body;
    },
  };
}

/** Maps an HTTP failure to a stable code and a next step. O(1). CC 6. */
export function httpError(status: number, body: Json): PinterestError {
  const message = typeof body.message === "string" ? body.message : `Pinterest returned HTTP ${status}.`;
  if (status === 401) return new PinterestError("UNAUTHORIZED", message, [`Check that ${TOKEN_VARIABLE} is valid and not expired.`]);
  if (status === 403) return new PinterestError("FORBIDDEN", message, ["The token may lack the scope for this call (boards:read, pins:read, user_accounts:read)."]);
  if (status === 404) return new PinterestError("NOT_FOUND", message);
  if (status === 429) return new PinterestError("RATE_LIMITED", message, ["Wait and retry; Pinterest rate limits per token."]);
  return new PinterestError("API_ERROR", message);
}

const str = (value: unknown) => (typeof value === "string" ? value : undefined);
const clip = (value: unknown, max = 200) => {
  const text = str(value);
  return text && text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

function pinImage(pin: Json): string | undefined {
  const images = (pin.media as Json | undefined)?.images as Record<string, { url?: string }> | undefined;
  if (!images) return undefined;
  return (images["600x"] ?? images.originals ?? Object.values(images)[0])?.url;
}

/** Compact, flat pin row (keeps TOON tabular). O(1). CC 2. */
export function summarizePin(pin: Json) {
  return {
    id: str(pin.id),
    title: clip(pin.title, 120),
    description: clip(pin.description),
    link: str(pin.link),
    board_id: str(pin.board_id),
    created_at: str(pin.created_at),
    media_type: str((pin.media as Json | undefined)?.media_type),
    image: pinImage(pin),
  };
}

export function summarizeBoard(board: Json) {
  return {
    id: str(board.id),
    name: str(board.name),
    description: clip(board.description),
    privacy: str(board.privacy),
    pin_count: board.pin_count,
    follower_count: board.follower_count,
  };
}

export function summarizeAccount(account: Json) {
  return {
    id: str(account.id),
    username: str(account.username),
    account_type: str(account.account_type),
    board_count: account.board_count,
    pin_count: account.pin_count,
    follower_count: account.follower_count,
    website_url: str(account.website_url),
  };
}

function page(body: Json, rows: Json[], summarize: (row: Json) => Json) {
  const items = rows.map(summarize);
  const bookmark = str(body.bookmark);
  return { count: items.length, items, ...(bookmark ? { next_cursor: bookmark } : {}) };
}

export interface PageArgs {
  limit?: number;
  cursor?: string;
}

const pageQuery = ({ limit, cursor }: PageArgs): Query => ({ page_size: limit, bookmark: cursor });
const items = (body: Json) => (Array.isArray(body.items) ? (body.items as Json[]) : []);

export const whoami = async (client: Client) => summarizeAccount(await client.get("/user_account"));

export async function listBoards(client: Client, args: PageArgs) {
  const body = await client.get("/boards", pageQuery(args));
  return page(body, items(body), summarizeBoard);
}

export async function listPins(client: Client, args: PageArgs & { board: string }) {
  const body = await client.get(`/boards/${args.board}/pins`, pageQuery(args));
  return page(body, items(body), summarizePin);
}

export async function getPin(client: Client, args: { pin: string }) {
  return summarizePin(await client.get(`/pins/${args.pin}`));
}

/** The search endpoint takes no page_size, so --limit does not apply to it. */
export async function searchPins(client: Client, args: { query: string; cursor?: string }) {
  const body = await client.get("/search/pins", { query: args.query, bookmark: args.cursor });
  return page(body, items(body), summarizePin);
}
