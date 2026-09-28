import { runAxiCli } from "axi-sdk-js";
import { home } from "./commands/home.ts";
import { runHoncho } from "./honcho.ts";
import { VERSION } from "./version.ts";

const passthroughCommands = [
  "workspace",
  "peer",
  "session",
  "message",
  "conclusion",
];

const commands = Object.fromEntries(
  passthroughCommands.map((command) => [
    command,
    (args: string[]) => runHoncho([command, ...args]),
  ]),
);

export async function main() {
  await runAxiCli({
    description: "Inspect and manage Honcho workspaces, peers, sessions, and memory.",
    version: VERSION,
    packageName: "honcho-axi",
    argv: process.argv.slice(2),
    topLevelHelp: [
      "Honcho AXI",
      "Commands: workspace, peer, session, message, conclusion",
      "Examples:",
      "  honcho-axi workspace list",
      "  honcho-axi peer search <query> -w <workspace>",
      "  honcho-axi session context -s <session> -w <workspace>",
      "Run `honcho-axi <command> --help` for command usage.",
    ].join("\n"),
    commands,
    home,
    getCommandHelp(command) {
      if (passthroughCommands.includes(command)) {
        return `Pass arguments to the matching honcho ${command} command.`;
      }
      return undefined;
    },
  });
}
