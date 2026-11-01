const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-projecao-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';
process.env.APP_TIMEZONE = 'America/Sao_Paulo';

const app = require('../src/server');
const db = require('../src/db');

async function jsonFetch(baseUrl, rota, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${rota}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', ...(opcoes.headers || {}) },
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

test('projeção do mês ignora despesas futuras no ritmo e usa o mês anterior no começo do mês', async (t) => {
  // 02/11/2026 às 12h em Brasília.
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-02T15:00:00Z') });

  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  const email = 'projecao@example.com';
  await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST', body: JSON.stringify({ nome: 'Projeção', email, senha: 'senha123' }),
  });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);
  const login = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, senha: 'senha123' }),
  });
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };
  const categoriaId = (await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado })).corpo[0].id;
  const lancar = async (descricao, valor, data) => {
    const resultado = await jsonFetch(baseUrl, '/api/despesas', {
      method: 'POST', headers: autenticado,
      body: JSON.stringify({ descricao, valor, categoria_id: categoriaId, data }),
    });
    assert.equal(resultado.status, 201);
  };

  // Novembro: 100 gastos até hoje + 900 de conta agendada para o dia 20.
  await lancar('Mercado', 100, '2026-11-01');
  await lancar('Escola', 900, '2026-11-20');

  // Sem outubro, dia 2 ainda não tem ritmo confiável: sem projeção.
  let resumo = (await jsonFetch(baseUrl, '/api/resumo', { headers: autenticado })).corpo;
  assert.equal(resumo.totalGasto, 1000);
  assert.equal(resumo.projecaoMes, 0);
  assert.equal(resumo.projecaoUsaMesAnterior, false);

  // Outubro com 310 de gastos variáveis = 10 por dia.
  await lancar('Outubro', 310, '2026-10-15');
  resumo = (await jsonFetch(baseUrl, '/api/resumo', { headers: autenticado })).corpo;
  // Ritmo = (100 + 10 × 5) / 7; projeção = 1000 + ritmo × 28 dias restantes.
  assert.equal(resumo.projecaoMes, Number((1000 + (150 / 7) * 28).toFixed(2)));
  assert.equal(resumo.projecaoUsaMesAnterior, true);
});
