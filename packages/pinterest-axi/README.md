# Pinterest AXI

Pinterest AXI reads your Pinterest account, boards and pins through the official [Pinterest API v5](https://developers.pinterest.com/docs/api/v5/). It is one core exposed two ways: an agent-facing CLI with compact TOON output, and an MCP server over stdio.

This first version is read-only. It has not been published to npm yet; run it from a checkout.

The package is marked `private` until npm trusted publishing is set up for it, so the release workflow skips it.

## Fastest way to use it

Tell your agent: use `npx -y pinterest-axi` (once published).

```bash
export PINTEREST_ACCESS_TOKEN=...   # see Configuration
npx -y pinterest-axi
```

## Commands

| Command | What it does | API endpoint |
| --- | --- | --- |
| `whoami` | Show the account the token belongs to | `GET /user_account` |
| `boards [--limit N] [--cursor C]` | List boards | `GET /boards` |
| `pins <board> [--limit N] [--cursor C]` | List the pins on a board | `GET /boards/{board_id}/pins` |
| `pin <id>` | Get one pin | `GET /pins/{pin_id}` |
| `search <query> [--cursor C]` | Search your own pins by keyword or comma-separated pin IDs | `GET /search/pins` |
| `mcp` | Serve the same operations as MCP tools over stdio | |

Lists print `count`, `items` and, when more remain, `next_cursor`. Pass it back as `--cursor` for the next page. `--limit` is 1 to 250 (Pinterest's default is 25). The search endpoint takes no page size.

## MCP server

Add `pinterest-axi mcp` to an MCP client, with the token in its environment:

```json
{ "mcpServers": { "pinterest": { "command": "npx", "args": ["-y", "pinterest-axi", "mcp"], "env": { "PINTEREST_ACCESS_TOKEN": "..." } } } }
```

Tools: `pinterest_whoami`, `pinterest_list_boards`, `pinterest_list_pins`, `pinterest_get_pin`, `pinterest_search_pins`. All are marked read-only, and results are the same TOON text the CLI prints.

## Configuration

Set `PINTEREST_ACCESS_TOKEN` to a Pinterest API access token. Create one in the [Pinterest developer portal](https://developers.pinterest.com/apps/) with the `user_accounts:read`, `boards:read` and `pins:read` scopes (add `boards:read_secret` and `pins:read_secret` for secret boards and pins). The token is never printed. A missing token returns a structured `TOKEN_REQUIRED` error.

Set `PINTEREST_API_BASE` to use another API host, for example `https://api-sandbox.pinterest.com/v5`. The default is `https://api.pinterest.com/v5`.

## Requirements

Use Node.js 22.18 or later.

## Follow-ups

Writes (create a board, create a pin) are out of scope for this version.

## Reference

### Development

Run `npm run build` to type-check the source and verify the generated skill pointer.

Run `npm test` to execute the local suite. It uses a local mock server, needs no token and makes no live API calls.

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and verification steps.

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

### License

See [LICENSE](LICENSE) for license terms.
