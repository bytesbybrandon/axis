import type { APIRoute } from 'astro';
import { loadCatalog } from '../lib/catalog';
import { llmsTxt } from '../lib/docs';
import { absolute } from '../lib/site';

export const GET: APIRoute = ({ site }) =>
  new Response(llmsTxt(loadCatalog(), (p) => absolute(p, site)), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
