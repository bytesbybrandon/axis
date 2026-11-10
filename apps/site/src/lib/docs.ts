import { encode } from '@toon-format/toon';
import type { Axi } from './catalog.ts';
import { REPO } from './catalog.ts';
import { suggestedCommands } from './commands.ts';

/** The registry as data. One shape feeds the JSON, the TOON and the llms.txt, so they cannot disagree. */
export function registryDoc(axis: Axi[], pageUrl: (path: string) => string) {
  return {
    registry: 'axis',
    maintainer: 'bytesbybrandon',
    source: REPO,
    count: axis.length,
    axis: axis.map((a) => ({
      name: a.name,
      version: a.version,
      install: a.install,
      tags: a.tags.join(' '),
      description: a.description,
    })),
    help: [
      `Run \`curl ${pageUrl('axi/')}<name>.toon.txt\` for one AXI's record`,
      `Run \`npx -y <name>\` to run an AXI with no arguments`,
    ],
  };
}

export function axiDoc(a: Axi, pageUrl: (path: string) => string) {
  const next = [`Run \`${a.install}\` to see its output with no arguments`, `Open ${pageUrl(`axi/${a.name}/`)} for the README`];
  return {
    name: a.name,
    version: a.version,
    description: a.description,
    license: a.license,
    commands: a.bins.join(' '),
    tags: a.tags.join(' '),
    install: a.install,
    source: a.repoUrl,
    npm: a.npmUrl,
    bare_output_lines: a.home ? a.home.text.split('\n').length : 0,
    bare_output_commands: a.home ? suggestedCommands(a.home.text).length : 0,
    next,
  };
}

export const toToon = (doc: unknown): string => `${encode(doc)}\n`;
export const toJson = (doc: unknown): string => JSON.stringify(doc, null, 2);

export function llmsTxt(axis: Axi[], pageUrl: (path: string) => string): string {
  const lines = [
    '# axis',
    '',
    '> Agent eXperience Interfaces (AXIs) by bytesbybrandon: agent-facing command-line tools that follow https://axi.md. Run with no arguments, each prints its state, then what to run next.',
    '',
    '## AXIs',
    '',
    ...axis.map((a) => `- [${a.name}](${pageUrl(`axi/${a.name}/`)}): ${a.description.replace(/\.?$/, '.')} Run \`${a.install}\`.`),
    '',
    '## For agents',
    '',
    `- [catalog.toon.txt](${pageUrl('catalog.toon.txt')}): every AXI in TOON, the compact form AXIs print`,
    `- [catalog.json](${pageUrl('catalog.json')}): the same catalog as indented JSON`,
    `- Per-AXI records live at ${pageUrl('axi/')}<name>.toon.txt`,
    '',
    '## Source',
    '',
    `- [${REPO}](${REPO}): one directory per AXI under packages/`,
    '',
  ];
  return lines.join('\n');
}
