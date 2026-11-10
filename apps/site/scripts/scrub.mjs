// Normalises a captured home view so the snapshot does not depend on the machine that took it.
// Absolute paths become placeholders; nothing else about the output is edited.
export function scrubHome(text, cwds = []) {
  let out = text.replace(/\r\n?/g, '\n');
  for (const cwd of [...cwds].sort((a, b) => b.length - a.length)) {
    if (cwd) out = out.split(cwd).join('<cwd>');
  }
  out = out.replace(/^(\s*bin:\s*)\S.*$/gm, '$1<path>');
  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n');
  return out.replace(/^\n+/, '').replace(/\n+$/, '');
}
