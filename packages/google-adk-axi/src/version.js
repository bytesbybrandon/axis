import { readFileSync } from "node:fs";
// package.json is the single source of truth, so `changeset version` needs no second edit.
export const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
