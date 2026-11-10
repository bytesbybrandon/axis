import type { APIRoute } from 'astro';
import { loadCatalog } from '../lib/catalog';
import { registryDoc, toJson } from '../lib/docs';
import { absolute } from '../lib/site';

export const GET: APIRoute = ({ site }) =>
  new Response(toJson(registryDoc(loadCatalog(), (p) => absolute(p, site))), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
