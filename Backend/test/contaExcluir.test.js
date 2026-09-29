const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-conta-test-'));
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

test('excluir a própria conta apaga o usuário e os dados dependentes (cascade)', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });

  const { port } = servidor.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const email = 'excluir-conta@example.com';

  let resultado = await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Vai Excluir', email, senha: 'senha123' }),
  });
  assert.equal(resultado.resposta.status, 201);
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);

  resultado = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: 'senha123' }),
  });
  assert.equal(resultado.resposta.status, 200);
  const token = resultado.corpo.token;
  const usuarioId = resultado.corpo.usuario.id;
  const autenticado = { Authorization: `Bearer ${token}` };

  // Categorias padrão já são criadas no cadastro — usa uma delas pra cadastrar
  // uma despesa, garantindo que existe algo pra cascatear na exclusão.
  const categoriaId = db.prepare('SELECT id FROM categorias WHERE usuario_id = ?').get(usuarioId).id;
  const hoje = new Date().toISOString().slice(0, 10);
  resultado = await jsonFetch(baseUrl, '/api/despesas', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ descricao: 'Antes de excluir', valor: 10, categoria_id: categoriaId, data: hoje }),
  });
  assert.equal(resultado.resposta.status, 201);

  // Senha errada não deve excluir nada.
  resultado = await jsonFetch(baseUrl, '/api/auth/conta', {
    method: 'DELETE',
    headers: autenticado,
    body: JSON.stringify({ senha: 'senha-errada' }),
  });
  assert.equal(resultado.resposta.status, 401);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total, 1);

  resultado = await jsonFetch(baseUrl, '/api/auth/conta', {
    method: 'DELETE',
    headers: autenticado,
    body: JSON.stringify({ senha: 'senha123' }),
  });
  assert.equal(resultado.resposta.status, 204);

  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM usuarios WHERE id = ?').get(usuarioId).total, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM categorias WHERE usuario_id = ?').get(usuarioId).total, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM despesas WHERE usuario_id = ?').get(usuarioId).total, 0);

  resultado = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: 'senha123' }),
  });
  assert.equal(resultado.resposta.status, 401);
});
