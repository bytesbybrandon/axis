// Browser replacement for node:path: tttui-axi only joins the working directory and a file name.
export function resolve(...parts: string[]): string {
  return `/${parts.join('/')}`.replace(/\/+/g, '/');
}

export default { resolve };
