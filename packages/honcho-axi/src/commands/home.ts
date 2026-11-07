import { runHoncho } from "../honcho.ts";

export async function home() {
  const health = runHoncho(["doctor"]);
  const workspaces = runHoncho(["workspace", "list"]);

  return {
    service: "Honcho",
    status: health.ok ? "connected" : "unavailable",
    selected_workspace: process.env.HONCHO_WORKSPACE_ID || null,
    health,
    workspaces,
    next_step: health.ok
      ? "Use peer chat or search to retrieve context from Honcho."
      : "Install honcho-cli, run honcho init, then rerun honcho-axi.",
    help: [
      "Run `honcho-axi peer list -w <workspace>` to list peers.",
      "Run `honcho-axi session list -w <workspace>` to list sessions.",
      "Install honcho-cli and run `honcho init` if the CLI is unavailable.",
    ],
  };
}
