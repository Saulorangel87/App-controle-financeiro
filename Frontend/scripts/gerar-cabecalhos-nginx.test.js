import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const script = join(__dirname, 'gerar-cabecalhos-nginx.mjs');
const modelo = join(__dirname, '..', 'nginx', 'cabecalhos-seguranca.conf');

function gerar(html, env = {}) {
  const pasta = mkdtempSync(join(tmpdir(), 'csp-'));
  writeFileSync(join(pasta, 'index.html'), html);
  execFileSync(process.execPath, [script, modelo, join(pasta, 'index.html'), join(pasta, 'saida.conf')], {
    env: { ...process.env, ...env },
  });
  return readFileSync(join(pasta, 'saida.conf'), 'utf8');
}

describe('gerar-cabecalhos-nginx', () => {
  it('autoriza o script inline pelo hash exato (inclusive com CRLF) e a origem da API', () => {
    const codigo = '\r\n  document.documentElement.dataset.theme = "dark";\r\n';
    const conf = gerar(`<head><script>${codigo}</script><script type="module" src="/a.js"></script></head>`, {
      VITE_API_URL: 'https://despesas-api.devsaulo.com.br/api',
    });
    const hash = createHash('sha256').update(codigo).digest('base64');
    expect(conf).toContain(`script-src 'self' 'sha256-${hash}';`);
    expect(conf).toContain("connect-src 'self' https://despesas-api.devsaulo.com.br;");
    expect(conf).not.toMatch(/__[A-Z_]+__/);
  });

  it('o index.html real tem exatamente um script inline (o do tema)', () => {
    const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');
    expect([...html.matchAll(/<script>/g)]).toHaveLength(1);
  });
});
