import type { APIRoute } from 'astro';
import { loadCatalog } from '../../lib/catalog';
import { axiDoc, toToon } from '../../lib/docs';
import { absolute } from '../../lib/site';

export function getStaticPaths() {
  return loadCatalog().map((axi) => ({ params: { slug: axi.name }, props: { axi } }));
}

export const GET: APIRoute = ({ props, site }) =>
  new Response(toToon(axiDoc(props.axi, (p) => absolute(p, site))), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
