import type { APIRoute } from 'astro';
import { loadCatalog } from '../../lib/catalog';
import { renderCard } from '../../lib/og';

export const GET: APIRoute = async () => {
  const axis = loadCatalog();
  const shown = axis.find((a) => a.name === 'tttui-axi' && a.home) ?? axis.find((a) => a.home);
  const png = await renderCard({
    hue: 55,
    size: 68,
    title: 'Command lines your agent can read.',
    subtitle: 'With no arguments, each prints its state, then what to run next.',
    output: shown?.home?.text ?? '',
  });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
