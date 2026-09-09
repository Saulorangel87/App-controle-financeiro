const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/server');

test('health check confirma que a API e o banco estão disponíveis', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => servidor.close());

  const { port } = servidor.address();
  const resposta = await fetch(`http://127.0.0.1:${port}/api/health`);
  const corpo = await resposta.json();

  assert.equal(resposta.status, 200);
  assert.deepEqual(corpo, { status: 'ok', banco: 'ok' });
  assert.equal(resposta.headers.get('x-content-type-options'), 'nosniff');
});
