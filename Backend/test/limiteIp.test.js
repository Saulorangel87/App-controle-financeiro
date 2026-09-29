const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-limite-test-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';

const app = require('../src/server');
const db = require('../src/db');

test('rate limit usa o IP do cliente (último salto do X-Forwarded-For) e não aceita forjar', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const { port } = servidor.address();

  const tentar = async (xff) => (await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': xff },
    body: JSON.stringify({ email: 'ninguem@example.com', senha: 'errada' }),
  })).status;

  // Cliente A (IP real 1.1.1.1, último salto) erra 5 vezes, mudando o IP "forjado" no início.
  for (let i = 0; i < 5; i += 1) assert.equal(await tentar(`10.0.0.${i}, 1.1.1.1`), 401);
  // A 6ª é bloqueada mesmo com outro valor forjado: forjar o começo do cabeçalho não ajuda.
  assert.equal(await tentar('99.99.99.99, 1.1.1.1'), 429);
  // Outro cliente (IP real 2.2.2.2) não é afetado pelo bloqueio do A.
  assert.equal(await tentar('10.0.0.1, 2.2.2.2'), 401);
});
