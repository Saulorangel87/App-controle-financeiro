const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-forma-pagamento-test-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';

const app = require('../src/server');
const db = require('../src/db');

async function jsonFetch(baseUrl, rota, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${rota}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', ...(opcoes.headers || {}) },
  });
  const texto = await resposta.text();
  return { resposta, corpo: texto ? JSON.parse(texto) : null };
}

test('forma de pagamento é validada, salva e filtrável em despesas e relatório', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });

  const { port } = servidor.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const email = 'forma-pagamento@example.com';

  await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Teste Pagamento', email, senha: 'senha123' }),
  });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);

  const login = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: 'senha123' }),
  });
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };
  const categoriaId = (await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado })).corpo[0].id;
  const hoje = new Date().toISOString().slice(0, 10);

  let resultado = await jsonFetch(baseUrl, '/api/despesas', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ descricao: 'Forma inválida', valor: 10, categoria_id: categoriaId, data: hoje, forma_pagamento: 'cheque' }),
  });
  assert.equal(resultado.resposta.status, 400);

  resultado = await jsonFetch(baseUrl, '/api/despesas', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ descricao: 'Pago no pix', valor: 10, categoria_id: categoriaId, data: hoje, forma_pagamento: 'pix' }),
  });
  assert.equal(resultado.resposta.status, 201);
  assert.equal(resultado.corpo.forma_pagamento, 'pix');

  resultado = await jsonFetch(baseUrl, '/api/despesas', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ descricao: 'Sem forma informada', valor: 20, categoria_id: categoriaId, data: hoje }),
  });
  assert.equal(resultado.resposta.status, 201);
  assert.equal(resultado.corpo.forma_pagamento, null);

  resultado = await jsonFetch(baseUrl, '/api/despesas?forma_pagamento=pix', { headers: autenticado });
  assert.equal(resultado.corpo.length, 1);
  assert.equal(resultado.corpo[0].descricao, 'Pago no pix');

  resultado = await jsonFetch(baseUrl, `/api/relatorio?mes=${hoje.slice(0, 7)}&forma_pagamento=pix`, { headers: autenticado });
  assert.equal(resultado.corpo.totalAtual, 10);
  assert.equal(resultado.corpo.despesas.length, 1);
});
