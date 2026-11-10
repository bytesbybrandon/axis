import { createMarkdownProcessor } from '@astrojs/markdown-remark';

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;

const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i;

/** Relative README links point into the package directory on GitHub. */
export function rewriteLinks(html: string, repoUrl: string): string {
  return html.replace(/(<a [^>]*?href=")([^"]+)(")/g, (match, pre: string, href: string, post: string) => {
    if (ABSOLUTE.test(href)) return match;
    return `${pre}${repoUrl.replace('/tree/', '/blob/')}/${href.replace(/^\.\//, '')}${post}`;
  });
}

const EMOJI = /[\p{Extended_Pictographic}\u200d\ufe0f]+\s*/gu;

/** Drops the README's own title (the page has one), badge images and heading emoji, and steps headings down one level. */
export function adaptReadme(html: string): string {
  return html
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/, '')
    .replace(/<img\b[^>]*>/g, '')
    .replace(/<p>\s*(?:<a\b[^>]*>\s*<\/a>\s*)*<\/p>\s*/g, '')
    .replace(/(<h[2-6]\b[^>]*>)([\s\S]*?)(<\/h[2-6]>)/g, (_m, open: string, text: string, close: string) => `${open}${text.replace(EMOJI, '')}${close}`)
    .replace(/<(\/?)h([2-5])\b([^>]*)>/g, (_m, slash: string, level: string, rest: string) => `<${slash}h${Number(level) + 1}${rest}>`);
}

export async function renderReadme(markdown: string, repoUrl: string): Promise<string> {
  processor ??= createMarkdownProcessor({ syntaxHighlight: false, gfm: true });
  const { code } = await (await processor).render(markdown);
  return adaptReadme(rewriteLinks(code, repoUrl));
}
