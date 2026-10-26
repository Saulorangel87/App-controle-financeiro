const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-filtro-mes-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';

const app = require('../src/server');
const db = require('../src/db');
const { intervaloDosMeses } = require('../src/utils/datas');
const { somaEmReaisSQL } = require('../src/utils/dinheiro');

async function jsonFetch(baseUrl, rota, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${rota}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', ...(opcoes.headers || {}) },
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

test('intervaloDosMeses cobre o mês inteiro, inclusive na virada do ano', () => {
  assert.deepEqual(intervaloDosMeses('2026-02'), ['2026-02-01', '2026-03-01']);
  assert.deepEqual(intervaloDosMeses('2026-12'), ['2026-12-01', '2027-01-01']);
  assert.deepEqual(intervaloDosMeses('2026-11', '2027-01'), ['2026-11-01', '2027-02-01']);
});

test('somaEmReaisSQL soma centavos inteiros e cai no valor legado sem centavos', () => {
  const linhas = db.prepare(`
    WITH t(valor, valor_centavos) AS (VALUES (0.1, NULL), (0.2, NULL), (999, 1099))
    SELECT ${somaEmReaisSQL()} AS total FROM t
  `).get();
  assert.equal(linhas.total, 11.29);
  assert.equal(db.prepare(`SELECT ${somaEmReaisSQL()} AS total FROM despesas WHERE 0`).get().total, 0);
});

test('filtros por mês incluem o último dia e excluem o primeiro dia do mês seguinte', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  const email = 'filtro-mes@example.com';
  await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST', body: JSON.stringify({ nome: 'Filtro', email, senha: 'senha123' }),
  });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);
  const login = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, senha: 'senha123' }),
  });
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };
  const usuarioId = login.corpo.usuario.id;
  const categoriaId = (await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado })).corpo[0].id;

  // Inseridas direto no banco: a API recusa datas futuras e o teste não pode
  // depender do dia em que roda.
  const despesa = db.prepare(`
    INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, valor_centavos, data)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  despesa.run(usuarioId, categoriaId, 'Novembro', 5, 500, '2026-11-30');
  despesa.run(usuarioId, categoriaId, 'Primeiro dia', 10, 1000, '2026-12-01');
  despesa.run(usuarioId, categoriaId, 'Réveillon', 20.1, 2010, '2026-12-31');
  despesa.run(usuarioId, categoriaId, 'Ano novo', 40, 4000, '2027-01-01');
  const entrada = db.prepare(`
    INSERT INTO entradas (usuario_id, origem, valor, valor_centavos, data) VALUES (?, ?, ?, ?, ?)
  `);
  entrada.run(usuarioId, 'Bônus', 100, 10000, '2026-12-31');
  entrada.run(usuarioId, 'Salário', 1000, 100000, '2027-01-01');

  let resultado = await jsonFetch(baseUrl, '/api/despesas?mes=2026-12', { headers: autenticado });
  assert.deepEqual(resultado.corpo.map((d) => d.descricao), ['Réveillon', 'Primeiro dia']);

  resultado = await jsonFetch(baseUrl, '/api/despesas?mes=2026-12&pagina=1', { headers: autenticado });
  assert.equal(resultado.corpo.total, 2);
  assert.equal(resultado.corpo.totalGeral, 30.1);

  resultado = await jsonFetch(baseUrl, '/api/entradas?mes=2026-12', { headers: autenticado });
  assert.deepEqual(resultado.corpo.map((e) => e.origem), ['Bônus']);

  resultado = await jsonFetch(baseUrl, '/api/entradas?mes=2026-13', { headers: autenticado });
  assert.equal(resultado.status, 400);

  resultado = await jsonFetch(baseUrl, '/api/relatorio?mes=2026-12', { headers: autenticado });
  assert.equal(resultado.corpo.totalAtual, 30.1);
  assert.equal(resultado.corpo.totalAnterior, 5);
  assert.equal(resultado.corpo.despesas.length, 2);
  assert.equal(resultado.corpo.totalEntradas, 100);

  resultado = await jsonFetch(baseUrl, '/api/relatorio?mes=2026-13', { headers: autenticado });
  assert.equal(resultado.status, 400);

  db.prepare('UPDATE categorias SET limite = 25, limite_centavos = 2500 WHERE id = ?').run(categoriaId);
  resultado = await jsonFetch(baseUrl, '/api/relatorio?mes=2026-12', { headers: autenticado });
  assert.deepEqual(resultado.corpo.categoriasExcedidas.map((c) => [c.id, c.gasto]), [[categoriaId, 30.1]]);

  // Meta de novembro a dezembro: 100 de entrada − (5 + 10 + 20,10) de gastos.
  db.prepare(`
    INSERT INTO metas (usuario_id, nome, valor_alvo, mes_inicio, mes_fim) VALUES (?, ?, ?, ?, ?)
  `).run(usuarioId, 'Reserva', 1000, '2026-11', '2026-12');
  resultado = await jsonFetch(baseUrl, '/api/metas', { headers: autenticado });
  assert.equal(resultado.corpo[0].progresso, 64.9);
});
