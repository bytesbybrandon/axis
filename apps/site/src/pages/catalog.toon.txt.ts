import type { APIRoute } from 'astro';
import { loadCatalog } from '../lib/catalog';
import { registryDoc, toToon } from '../lib/docs';
import { absolute } from '../lib/site';

export const GET: APIRoute = ({ site }) =>
  new Response(toToon(registryDoc(loadCatalog(), (p) => absolute(p, site))), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
