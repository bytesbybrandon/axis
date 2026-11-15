import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'research-axi-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

// Original synthetic fixture: no downloaded paper text or executable instructions.
export function pdfFixture(pages = ['Methods: We compare bounded retrieval against a fixed reference.', 'Limitations: Scanned pages need external OCR.']) {
  const escape = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
  const objects = ['', '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const kids = [];
  for (const text of pages) {
    const page = objects.length, content = page + 1;
    kids.push(`${page} 0 R`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`);
    const stream = text ? `BT /F1 12 Tf 50 760 Td (${escape(text)}) Tj ET` : '';
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  let body = '%PDF-1.4\n'; const offsets = [0];
  for (let n = 1; n < objects.length; n++) { offsets.push(Buffer.byteLength(body)); body += `${n} 0 obj\n${objects[n]}\nendobj\n`; }
  const start = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(body);
}
export async function localPdf(root, pages) {
  const path = join(root, 'paper.pdf'); const bytes = pdfFixture(pages);
  await writeFile(path, bytes); return { path, bytes, source: `local:${path}` };
}
export function feed(ids = ['2501.13956v1'], total = ids.length) {
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/" xmlns:arxiv="http://arxiv.org/schemas/atom"><opensearch:totalResults>${total}</opensearch:totalResults>${ids.map((id) => `<entry><id>http://arxiv.org/abs/${id}</id><title>Bounded &amp; exact retrieval ${id}</title><published>2025-01-24T00:00:00Z</published><summary>This abstract is discovery metadata.</summary><author><name>Fixture Author</name></author><arxiv:doi>10.1234/fixture</arxiv:doi></entry>`).join('')}</feed>`;
}
export const work = { id: 'https://openalex.org/W2741809807', title: 'Synthetic discovery work', publication_date: '2025-01-01', doi: 'https://doi.org/10.1234/fixture', abstract_inverted_index: { Bounded: [0], metadata: [1] }, authorships: [{ author: { display_name: 'Fixture Author' } }] };
export const jsonResponse = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
export const atomResponse = (ids, total) => new Response(feed(ids, total), { headers: { 'content-type': 'application/atom+xml' } });
