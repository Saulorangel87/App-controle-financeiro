const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-fuso-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';
process.env.APP_TIMEZONE = 'America/Sao_Paulo';

const app = require('../src/server');
const db = require('../src/db');
const { hojeISO, mesAtualISO } = require('../src/utils/datas');
const { calcularProjecaoMes } = require('../src/routes/resumo');

test('calcularProjecaoMes projeta o gasto proporcional aos dias do mês', () => {
  const projecao = calcularProjecaoMes(310, '2026-10-10');
  assert.equal(projecao.diaAtual, 10);
  assert.equal(projecao.diasNoMes, 31);
  assert.equal(projecao.projecaoMes, 961);
});

async function jsonFetch(baseUrl, rota, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${rota}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', ...(opcoes.headers || {}) },
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

test('hojeISO/mesAtualISO usam o fuso do app, não UTC', () => {
  // 31/10 às 23h30 em Brasília = 01/11 às 02h30 em UTC
  const virada = new Date('2026-11-01T02:30:00Z');
  assert.equal(hojeISO(virada), '2026-10-31');
  assert.equal(mesAtualISO(virada), '2026-10');
  assert.equal(hojeISO(new Date('2026-11-01T03:00:00Z')), '2026-11-01');
});

test('às 23h30 do último dia do mês a API ainda está no mês corrente', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-01T02:30:00Z') });

  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  const email = 'fuso@example.com';
  await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST', body: JSON.stringify({ nome: 'Fuso', email, senha: 'senha123' }),
  });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);
  const login = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, senha: 'senha123' }),
  });
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };
  const categorias = await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado });
  const categoriaId = categorias.corpo[0].id;

  // Em UTC já seria 01/11: a despesa entraria como "hoje" e cairia em novembro.
  let resultado = await jsonFetch(baseUrl, '/api/despesas', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ descricao: 'Amanhã', valor: 10, categoria_id: categoriaId, data: '2026-11-01' }),
  });
  assert.equal(resultado.status, 400, 'data de amanhã (no horário de Brasília) é futura');

  resultado = await jsonFetch(baseUrl, '/api/despesas', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ descricao: 'Jantar', valor: 50, categoria_id: categoriaId, data: '2026-10-31' }),
  });
  assert.equal(resultado.status, 201);

  resultado = await jsonFetch(baseUrl, '/api/resumo', { headers: autenticado });
  assert.equal(resultado.corpo.mes, '2026-10');
  assert.equal(resultado.corpo.totalGasto, 50, 'o dashboard ainda mostra outubro');
  assert.equal(resultado.corpo.diaAtual, 31);
  assert.equal(resultado.corpo.diasNoMes, 31);
  assert.equal(resultado.corpo.projecaoMes, 50);

  resultado = await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado });
  assert.equal(resultado.corpo.find((c) => c.id === categoriaId).gasto, 50);

  resultado = await jsonFetch(baseUrl, '/api/orcamento', { headers: autenticado });
  assert.equal(resultado.corpo.mes, '2026-10');

  resultado = await jsonFetch(baseUrl, '/api/relatorio/meses', { headers: autenticado });
  assert.equal(resultado.corpo[0], '2026-10');

  resultado = await jsonFetch(baseUrl, '/api/entradas', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ origem: 'Salário', valor: 1000, data: '2026-11-01' }),
  });
  assert.equal(resultado.status, 400, 'entrada com data de amanhã também é bloqueada');
});
