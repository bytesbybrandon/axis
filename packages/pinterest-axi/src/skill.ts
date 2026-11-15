export function createSkillMarkdown() {
  return [
    "---",
    "name: pinterest-axi",
    "description: Use the Pinterest AXI CLI or MCP server to read the account, boards, and pins from the Pinterest API v5.",
    "---",
    "",
    "# Pinterest AXI",
    "",
    "Use the `pinterest-axi` CLI for read-only Pinterest operations: `whoami`, `boards`, `pins <board>`, `pin <id>`, `search <query>`.",
    "",
    "Run `pinterest-axi --help` to see the command list. Page with `--limit` and `--cursor` (the `next_cursor` of the previous page).",
    "",
    "Run `pinterest-axi mcp` to serve the same operations as MCP tools over stdio.",
    "",
    "Set `PINTEREST_ACCESS_TOKEN` to a Pinterest access token. The token is never printed.",
    "",
  ].join("\n");
}
