import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { oklchToHex } from './color.ts';

const require = createRequire(join(process.cwd(), 'package.json'));
const font = (file: string): Buffer => readFileSync(require.resolve(file));

export interface Card {
  hue: number;
  title: string;
  subtitle: string;
  /** Captured bare output shown in the well. Lines are cut to fit, never reworded. */
  output: string;
  /** Title size in px; fitted to the column when omitted. */
  size?: number;
}

type Node = { type: string; props: { style?: Record<string, unknown>; children?: Node | Node[] | string } };
const el = (style: Record<string, unknown>, children?: Node | Node[] | string): Node => ({
  type: 'div',
  props: { style: { display: 'flex', ...style }, children },
});

const MAX_LINES = 14;
const MAX_CHARS = 38;
const CHAR_WIDTH = 12;

/** A 1200 by 630 social card in the page's own idiom: one drenched hue and a well holding the real output. */
export async function renderCard(card: Card): Promise<Uint8Array> {
  const { hue } = card;
  const paper = oklchToHex(0.74, 0.165, hue);
  const ink = oklchToHex(0.17, 0.03, hue - 10);
  const inkSoft = oklchToHex(0.26, 0.04, hue - 10);
  const well = oklchToHex(0.17, 0.025, hue - 10);
  const wellInk = oklchToHex(0.94, 0.02, hue + 25);
  const key = oklchToHex(0.82, 0.14, hue + 7);

  const lines = card.output.split('\n').slice(0, MAX_LINES).map((line) => (line.length > MAX_CHARS ? `${line.slice(0, MAX_CHARS - 1)}\u2026` : line));
  const rendered = lines.map((line) => {
    const m = /^(\s*)([A-Za-z_][\w-]*(?:\[\d+\])?)(:)(.*)$/.exec(line);
    const text = (color: string, value: string): Node => el({ color, whiteSpace: 'pre' }, value);
    const indent = (line.match(/^\s*/)?.[0].length ?? 0) * CHAR_WIDTH;
    return el({ height: 28, paddingLeft: indent }, m ? [text(key, m[2]), text(wellInk, `:${m[4]}`)] : [text(wellInk, line.trimStart() || ' ')]);
  });

  const perLine = card.title.length <= 10 ? card.title.length : Math.ceil(card.title.length / (card.title.length > 24 ? 4 : 2));
  const size = card.size ?? Math.min(104, Math.floor(480 / (0.6 * perLine)));
  const subtitle = card.subtitle.length > 72 ? `${card.subtitle.slice(0, 71).trimEnd()}\u2026` : card.subtitle;
  const tree = el(
    { boxSizing: 'border-box', width: 1200, height: 630, overflow: 'hidden', background: paper, color: ink, padding: 56, gap: 48, fontFamily: 'Funnel Display' },
    [
      el({ flexDirection: 'column', justifyContent: 'space-between', width: 480 }, [
        el({ fontSize: 40, fontWeight: 800, letterSpacing: -1.2 }, 'axis'),
        el({ flexDirection: 'column', gap: 20 }, [
          el({ fontSize: size, fontWeight: 800, lineHeight: 1, letterSpacing: -2, flexWrap: 'wrap', wordBreak: 'break-word' }, card.title),
          el({ fontSize: 26, fontWeight: 400, lineHeight: 1.3, color: inkSoft }, subtitle),
        ]),
      ]),
      el(
        { boxSizing: 'border-box', width: 560, flexDirection: 'column', justifyContent: 'center', overflow: 'hidden', background: well, borderRadius: 14, padding: 36, fontFamily: 'JetBrains Mono', fontSize: 20 },
        rendered,
      ),
    ],
  );

  const svg = await satori(tree as never, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Funnel Display', data: font('@fontsource/funnel-display/files/funnel-display-latin-800-normal.woff'), weight: 800, style: 'normal' },
      { name: 'Funnel Display', data: font('@fontsource/funnel-display/files/funnel-display-latin-400-normal.woff'), weight: 400, style: 'normal' },
      { name: 'JetBrains Mono', data: font('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff'), weight: 400, style: 'normal' },
    ],
  });
  return new Resvg(svg).render().asPng();
}
