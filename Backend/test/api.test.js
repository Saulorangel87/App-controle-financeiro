const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-test-'));
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

test('fluxo financeiro autenticado mantém orçamento e recorrentes consistentes', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });

  const { port } = servidor.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const email = 'teste-integracao@example.com';

  let resultado = await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Teste Integração', email, senha: 'senha123' }),
  });
  assert.equal(resultado.resposta.status, 201);

  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);

  resultado = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: 'senha123' }),
  });
  assert.equal(resultado.resposta.status, 200);
  const token = resultado.corpo.token;
  const autenticado = { Authorization: `Bearer ${token}` };

  resultado = await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado });
  assert.equal(resultado.resposta.status, 200);
  const categoriaId = resultado.corpo[0].id;

  resultado = await jsonFetch(baseUrl, '/api/despesas');
  assert.equal(resultado.resposta.status, 401);

  const hoje = new Date().toISOString().slice(0, 10);
  resultado = await jsonFetch(baseUrl, '/api/despesas', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ descricao: 'Teste de relatório', valor: 50, categoria_id: categoriaId, data: hoje }),
  });
  assert.equal(resultado.resposta.status, 201);

  resultado = await jsonFetch(baseUrl, `/api/relatorio?mes=${hoje.slice(0, 7)}&categoria_id=${categoriaId}`, {
    headers: autenticado,
  });
  assert.equal(resultado.resposta.status, 200);
  assert.equal(resultado.corpo.totalAtual, 50);
  assert.equal(resultado.corpo.despesas.length, 1);

  resultado = await jsonFetch(baseUrl, '/api/relatorio?mes=2026-09&categoria_id=999999', {
    headers: autenticado,
  });
  assert.equal(resultado.resposta.status, 400);

  resultado = await jsonFetch(baseUrl, '/api/entradas', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ origem: 'Salário', valor: 1000, data: hoje }),
  });
  assert.equal(resultado.resposta.status, 201);
  const entradaId = resultado.corpo.id;

  resultado = await jsonFetch(baseUrl, '/api/orcamento', { headers: autenticado });
  assert.equal(resultado.corpo.valor, 1000);

  resultado = await jsonFetch(baseUrl, '/api/entradas', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ origem: 'Inválida', valor: 'mil', data: hoje }),
  });
  assert.equal(resultado.resposta.status, 400);

  resultado = await jsonFetch(baseUrl, `/api/entradas/${entradaId}`, {
    method: 'DELETE',
    headers: autenticado,
  });
  assert.equal(resultado.resposta.status, 204);

  resultado = await jsonFetch(baseUrl, '/api/orcamento', { headers: autenticado });
  assert.equal(resultado.corpo.valor, 0);

  resultado = await jsonFetch(baseUrl, '/api/recorrentes', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ descricao: 'Internet', valor: 80 }),
  });
  assert.equal(resultado.resposta.status, 201);
  const recorrenteId = resultado.corpo.id;

  resultado = await jsonFetch(baseUrl, '/api/recorrentes', { headers: autenticado });
  assert.equal(resultado.corpo.totalCheio, 80);
  assert.equal(resultado.corpo.totalPago, 0);
  assert.equal(resultado.corpo.total, 80);

  resultado = await jsonFetch(baseUrl, `/api/recorrentes/${recorrenteId}/pago`, {
    method: 'PATCH',
    headers: autenticado,
    body: JSON.stringify({ pago: true }),
  });
  assert.equal(resultado.resposta.status, 200);

  resultado = await jsonFetch(baseUrl, '/api/recorrentes', { headers: autenticado });
  assert.equal(resultado.corpo.totalCheio, 80);
  assert.equal(resultado.corpo.totalPago, 80);
  assert.equal(resultado.corpo.total, 0);

  resultado = await jsonFetch(baseUrl, '/api/recorrentes', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ descricao: 'Notebook', valor: 200, parcela_total: 3 }),
  });
  assert.equal(resultado.resposta.status, 201);
  assert.equal(resultado.corpo.parcela_atual, 1);
  assert.equal(resultado.corpo.parcela_total, 3);
});
