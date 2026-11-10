/** Backticked commands in a captured output, each listed once: the next moves it suggests. */
export function suggestedCommands(text: string): string[] {
  return [...new Set([...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]))];
}

/** The subset a visitor can run as written: no `<placeholder>` or `[optional]` still to fill in. */
export function runnableCommands(text: string): string[] {
  return suggestedCommands(text).filter((c) => !/[<>[\]]/.test(c));
}
