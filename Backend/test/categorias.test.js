const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-categorias-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';

const app = require('../src/server');
const db = require('../src/db');
const { hojeISO } = require('../src/utils/datas');

async function jsonFetch(baseUrl, rota, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${rota}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', ...(opcoes.headers || {}) },
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

test('gerenciamento de categorias: criar, editar, impedir duplicadas e proteger exclusão', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  const email = 'categorias@example.com';
  await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST', body: JSON.stringify({ nome: 'Categorias', email, senha: 'senha123' }),
  });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);
  const login = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, senha: 'senha123' }),
  });
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };

  // Criar categoria nova
  const criada = await jsonFetch(baseUrl, '/api/categorias', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ nome: 'Pets', limite: 300, icone: 'heart', cor: '#ec4899' }),
  });
  assert.equal(criada.status, 201);
  assert.equal(criada.corpo.nome, 'Pets');

  // Nome duplicado (case-insensitive) é recusado
  const duplicada = await jsonFetch(baseUrl, '/api/categorias', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ nome: 'pets', limite: 200 }),
  });
  assert.equal(duplicada.status, 400);

  // Editar nome, ícone, cor e limite
  const editada = await jsonFetch(baseUrl, `/api/categorias/${criada.corpo.id}`, {
    method: 'PUT', headers: autenticado,
    body: JSON.stringify({ nome: 'Animais', limite: 350, icone: 'gift', cor: '#22c55e' }),
  });
  assert.equal(editada.status, 200);
  assert.equal(editada.corpo.nome, 'Animais');
  assert.equal(editada.corpo.limite, 350);

  // Categoria com despesa lançada não pode ser excluída
  await jsonFetch(baseUrl, '/api/despesas', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ descricao: 'Ração', valor: 90, categoria_id: criada.corpo.id, data: hojeISO() }),
  });
  const tentativaComDespesa = await jsonFetch(baseUrl, `/api/categorias/${criada.corpo.id}`, {
    method: 'DELETE', headers: autenticado,
  });
  assert.equal(tentativaComDespesa.status, 400);

  // Categoria vazia pode ser excluída
  const lista = (await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado })).corpo;
  const vazia = lista.find((c) => c.id !== criada.corpo.id);
  const excluida = await jsonFetch(baseUrl, `/api/categorias/${vazia.id}`, {
    method: 'DELETE', headers: autenticado,
  });
  assert.equal(excluida.status, 204);
});
