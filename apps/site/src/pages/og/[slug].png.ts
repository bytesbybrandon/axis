import type { APIRoute } from 'astro';
import { loadCatalog } from '../../lib/catalog';
import { renderCard } from '../../lib/og';

export function getStaticPaths() {
  return loadCatalog().map((axi) => ({ params: { slug: axi.name }, props: { axi } }));
}

export const GET: APIRoute = async ({ props }) => {
  const { axi } = props;
  const png = await renderCard({ hue: axi.hue, title: axi.name, subtitle: axi.description, output: axi.home?.text ?? axi.install });
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
