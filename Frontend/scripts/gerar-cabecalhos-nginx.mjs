// Preenche nginx/cabecalhos-seguranca.conf com o que só se sabe depois do
// build: o hash de cada <script> inline do dist/index.html (calculado sobre o
// arquivo gerado, então nunca sai de sincronia com o script do tema, nem com
// quebras de linha CRLF de um clone no Windows) e a origem da API.
//
// Uso: node scripts/gerar-cabecalhos-nginx.mjs <modelo> <index.html> <destino>
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [modelo, html, destino] = process.argv.slice(2);

const hashes = [...readFileSync(html, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(([, codigo]) => `'sha256-${createHash('sha256').update(codigo).digest('base64')}'`);

// Mesmo padrão de src/services/api.js. URL relativa (mesmo domínio) já é
// coberta pelo 'self'.
const urlApi = process.env.VITE_API_URL || 'http://localhost:3001/api';
let origemApi = '';
try {
  origemApi = new URL(urlApi).origin;
} catch {
  origemApi = '';
}

const conf = readFileSync(modelo, 'utf8')
  .replaceAll('__HASHES_SCRIPTS_INLINE__', hashes.join(' '))
  .replaceAll('__ORIGEM_API__', origemApi);

if (/__[A-Z_]+__/.test(conf)) {
  throw new Error('marcador sem valor em cabecalhos-seguranca.conf');
}
writeFileSync(destino, conf);
console.log(`CSP: ${hashes.length} script(s) inline, API em ${origemApi || "'self'"}`);
