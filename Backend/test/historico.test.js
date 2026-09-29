const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-historico-test-'));
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

function historicoDe(tabela, registroId) {
  return db.prepare(`
    SELECT acao, dados_antes, dados_depois FROM historico_alteracoes
    WHERE tabela = ? AND registro_id = ? ORDER BY id ASC
  `).all(tabela, registroId);
}

test('criar/editar/excluir despesas e entradas registra histórico de alterações', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });

  const { port } = servidor.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const email = 'historico@example.com';

  await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST',
    body: JSON.stringify({ nome: 'Teste Histórico', email, senha: 'senha123' }),
  });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);

  const login = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha: 'senha123' }),
  });
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };
  const categoriaId = (await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado })).corpo[0].id;
  const hoje = new Date().toISOString().slice(0, 10);

  const criada = await jsonFetch(baseUrl, '/api/despesas', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ descricao: 'Original', valor: 30, categoria_id: categoriaId, data: hoje }),
  });
  const despesaId = criada.corpo.id;

  await jsonFetch(baseUrl, `/api/despesas/${despesaId}`, {
    method: 'PUT',
    headers: autenticado,
    body: JSON.stringify({ descricao: 'Editada', valor: 50 }),
  });

  await jsonFetch(baseUrl, `/api/despesas/${despesaId}`, { method: 'DELETE', headers: autenticado });

  const historicoDespesa = historicoDe('despesas', despesaId);
  assert.deepEqual(historicoDespesa.map((h) => h.acao), ['criar', 'editar', 'excluir']);
  assert.equal(historicoDespesa[0].dados_antes, null);
  assert.equal(JSON.parse(historicoDespesa[0].dados_depois).descricao, 'Original');
  assert.equal(JSON.parse(historicoDespesa[1].dados_antes).valor, 30);
  assert.equal(JSON.parse(historicoDespesa[1].dados_depois).valor, 50);
  assert.equal(historicoDespesa[2].dados_depois, null);

  const entradaCriada = await jsonFetch(baseUrl, '/api/entradas', {
    method: 'POST',
    headers: autenticado,
    body: JSON.stringify({ origem: 'Freela', valor: 200, data: hoje }),
  });
  await jsonFetch(baseUrl, `/api/entradas/${entradaCriada.corpo.id}`, { method: 'DELETE', headers: autenticado });

  const historicoEntrada = historicoDe('entradas', entradaCriada.corpo.id);
  assert.deepEqual(historicoEntrada.map((h) => h.acao), ['criar', 'excluir']);
});
