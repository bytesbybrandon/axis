// Progressive enhancement only: with scripting off the page is a complete, readable document.
import { initCopy } from './copy.ts';
import { initCurtain } from './curtain.ts';
import { initPalette } from './palette.ts';
import { initRoster } from './roster.ts';

initCopy();
initRoster();
initPalette();
initCurtain();

// The hero game bundles the real tttui-axi, so only pages that show it load it.
if (document.querySelector('[data-play]')) void import('./play.ts');
