import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createSkillMarkdown } from "../src/skill.ts";

const SKILL_NAME = "google-adk-axi";
const checkOnly = process.argv.slice(2).includes("--check");
const unexpectedArguments = process.argv.slice(2).filter((argument) => argument !== "--check");

if (unexpectedArguments.length > 0) {
  throw new Error(`Unknown option: ${unexpectedArguments[0]}`);
}

const destination = resolve(import.meta.dirname, "..", "skills", SKILL_NAME, "SKILL.md");
const generated = createSkillMarkdown();

if (checkOnly) {
  let current: string;
  try {
    current = await readFile(destination, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      throw new Error(`Skill pointer is missing: ${destination}`);
    }
    throw error;
  }

  if (current !== generated) {
    throw new Error(`Skill pointer has drifted: ${destination}`);
  }
  process.stdout.write(`Skill pointer is current: ${destination}\n`);
} else {
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, generated, "utf8");
  process.stdout.write(`Wrote skill pointer: ${destination}\n`);
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}
