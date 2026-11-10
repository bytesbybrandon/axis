import { REPO } from './catalog.ts';

const issue = (title: string, body: string): string =>
  `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

/** Opens a prefilled issue asking for an AXI for a tool that has none yet. */
export const requestUrl = (): string =>
  issue('AXI request: ', 'Tool or service to wrap:\n\nWhat an agent needs to do with it:\n\nHow you run it today:\n');

/** Opens a prefilled issue against one AXI, carrying the version being used. */
export const reportUrl = (name: string, version: string): string =>
  issue(`${name}: `, `Package: ${name}@${version}\n\nWhat I ran:\n\nWhat I expected:\n\nWhat happened:\n`);
