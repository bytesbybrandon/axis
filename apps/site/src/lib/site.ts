/** Absolute-path helper that respects the Pages base path (`/axis` on github.io, `/` on a custom domain). */
export function href(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

/** Fully qualified URL for llms.txt, canonical links and the agent copies. */
export function absolute(path: string, site: URL | undefined): string {
  return new URL(href(path), site ?? 'http://localhost').toString();
}
