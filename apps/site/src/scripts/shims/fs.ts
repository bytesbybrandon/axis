// Browser replacement for node:fs, used only when bundling packages/tttui-axi for the hero.
import { files } from './store.ts';

export function existsSync(path: string): boolean {
  return files.has(path);
}

export function readFileSync(path: string): string {
  const value = files.get(path);
  if (value === undefined) throw new Error(`ENOENT: ${path}`);
  return value;
}

export function writeFileSync(path: string, data: unknown): void {
  files.set(path, String(data));
}

export default { existsSync, readFileSync, writeFileSync };
