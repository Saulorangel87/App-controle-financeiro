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

test('exige senha mínima de 8 caracteres, permite alterar senha, encerrar sessões e excluir a própria conta', async (t) => {
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

  // Senha com menos de 8 caracteres é recusada no cadastro.
  let resultado = await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Curta', email, senha: '1234567' }),
  });
  assert.equal(resultado.resposta.status, 400);

  resultado = await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Vai Excluir', email, senha: 'senha123' }),
  });
  assert.equal(resultado.resposta.status, 201);
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);

  const loginDispositivo1 = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: 'senha123' }),
  });
  assert.equal(loginDispositivo1.resposta.status, 200);
  const cookieDispositivo1 = loginDispositivo1.resposta.headers.get('set-cookie')?.split(';')[0];

  resultado = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: 'senha123' }),
  });
  assert.equal(resultado.resposta.status, 200);
  const token = resultado.corpo.token;
  const cookieDispositivo2 = resultado.resposta.headers.get('set-cookie')?.split(';')[0];
  const usuarioId = resultado.corpo.usuario.id;
  const autenticado = { Authorization: `Bearer ${token}` };

  // Alterar senha valida tamanho mínimo e senha atual, e revoga outras sessões.
  resultado = await jsonFetch(baseUrl, '/api/auth/alterar-senha', {
    method: 'POST',
    headers: { ...autenticado, Cookie: cookieDispositivo2 },
    body: JSON.stringify({ senhaAtual: 'senha123', novaSenha: 'curta' }),
  });
  assert.equal(resultado.resposta.status, 400);

  resultado = await jsonFetch(baseUrl, '/api/auth/alterar-senha', {
    method: 'POST',
    headers: { ...autenticado, Cookie: cookieDispositivo2 },
    body: JSON.stringify({ senhaAtual: 'errada123', novaSenha: 'novaSenha123' }),
  });
  assert.equal(resultado.resposta.status, 401);

  resultado = await jsonFetch(baseUrl, '/api/auth/alterar-senha', {
    method: 'POST',
    headers: { ...autenticado, Cookie: cookieDispositivo2 },
    body: JSON.stringify({ senhaAtual: 'senha123', novaSenha: 'novaSenha123' }),
  });
  assert.equal(resultado.resposta.status, 200);

  // Dispositivo 1 teve a sessão revogada pela troca de senha.
  const refreshDispositivo1 = await jsonFetch(baseUrl, '/api/auth/refresh', {
    method: 'POST',
    headers: { Cookie: cookieDispositivo1 },
  });
  assert.equal(refreshDispositivo1.resposta.status, 401);

  // Encerrar todas as sessões revoga também o dispositivo 2.
  resultado = await jsonFetch(baseUrl, '/api/auth/encerrar-sessoes', {
    method: 'POST',
    headers: autenticado,
  });
  assert.equal(resultado.resposta.status, 204);

  const refreshDispositivo2 = await jsonFetch(baseUrl, '/api/auth/refresh', {
    method: 'POST',
    headers: { Cookie: cookieDispositivo2 },
  });
  assert.equal(refreshDispositivo2.resposta.status, 401);

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

  // Senha antiga não exclui mais a conta.
  resultado = await jsonFetch(baseUrl, '/api/auth/conta', {
    method: 'DELETE',
    headers: { ...autenticado, 'x-forwarded-for': '10.0.0.2' },
    body: JSON.stringify({ senha: 'senha123' }),
  });
  assert.equal(resultado.resposta.status, 401);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total, 1);

  resultado = await jsonFetch(baseUrl, '/api/auth/conta', {
    method: 'DELETE',
    headers: { ...autenticado, 'x-forwarded-for': '10.0.0.2' },
    body: JSON.stringify({ senha: 'novaSenha123' }),
  });
  assert.equal(resultado.resposta.status, 204);

  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM usuarios WHERE id = ?').get(usuarioId).total, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM categorias WHERE usuario_id = ?').get(usuarioId).total, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM despesas WHERE usuario_id = ?').get(usuarioId).total, 0);

  resultado = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST',
    headers: { 'x-forwarded-for': '10.0.0.2' },
    body: JSON.stringify({ email, senha: 'novaSenha123' }),
  });
  assert.equal(resultado.resposta.status, 401);
});
