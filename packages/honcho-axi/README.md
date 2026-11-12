# Honcho AXI

Honcho AXI provides an agent-facing CLI for workspaces, peers, sessions, messages, and conclusions managed by the Honcho CLI.

It passes supported operations to the installed `honcho` executable and formats the result for agent use.

## Fastest way to use it

Tell your agent: use `npx -y honcho-axi`

```bash
npx -y honcho-axi
```

## Common tasks

Run `honcho-axi --help` to show the command list.

Run `honcho-axi workspace list` to list workspaces.

Pass further Honcho arguments after the command name.

For example, `honcho-axi peer search "product feedback" -w WORKSPACE_ID` searches a workspace.

## Requirements

Use Node.js 22.18 or later.

Install and configure the Honcho CLI with `honcho init` before running Honcho operations.

## Manual install and configuration

### Install a local command

Run `npm link` from this repository to link the checkout into npm's global command directory.

Then run `honcho-axi --help` or `honcho-axi workspace list` from any directory.

The local link uses this checkout and does not require an npm-published package.

### Run from a checkout

Run `npm ci` to install the locked dependencies.

Run `npm run axi -- --help` to show the command list.

Run `npm run axi -- workspace list` to list workspaces.

Pass further Honcho arguments after `npm run axi --`.

For example, `npm run axi -- peer search "product feedback" -w WORKSPACE_ID` searches a workspace.

### Configuration

The adapter returns a structured `HONCHO_CLI_NOT_FOUND` result if `honcho` is unavailable.

Set `HONCHO_BIN` to use a specific Honcho executable.

## Reference

### Development

Run `npm run build` to type-check the source and verify the generated skill pointer.

Run `npm test` to execute the local test suite.

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and verification steps.

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

### License

See [LICENSE](LICENSE) for license terms.
