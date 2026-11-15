#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const versionFlags = new Set(["-v", "-V", "--version", "--v"]);
// Read the manifest before any TypeScript/SDK initialization. The normal CLI
// imports the version leaf; package verification checks their agreement.
if (args.length === 1 && versionFlags.has(args[0])) {
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  process.stdout.write(`${version}\n`);
  process.exit(0);
}
const validFlags = ["-h", "--help", "-v", "-V", "--version", "--v"];
if (args[0]?.startsWith("-") && !validFlags.includes(args[0])) {
  process.stderr.write(`error: Unknown flag ${args[0]}\ncode: VALIDATION_ERROR\nvalid_flags[${validFlags.length}]: ${validFlags.join(",")}\n`);
  process.exitCode = 2;
} else {
  const source = new URL("../src/cli.ts", import.meta.url);
  const target = existsSync(fileURLToPath(source)) ? source : new URL("../dist/cli.js", import.meta.url);
  const { main } = await import(target);
  await main(args[0] === "-h" ? ["--help", ...args.slice(1)] : args);
}
