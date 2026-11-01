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

test('projeção do mês usa só o mês corrente e não multiplica despesas futuras', async (t) => {
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
  const entrar = async () => {
    const login = await jsonFetch(baseUrl, '/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, senha: 'senha123' }),
    });
    return { Authorization: `Bearer ${login.corpo.token}` };
  };
  let autenticado = await entrar();
  const categoriaId = (await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado })).corpo[0].id;
  const lancar = async (descricao, valor, data) => {
    const resultado = await jsonFetch(baseUrl, '/api/despesas', {
      method: 'POST', headers: autenticado,
      body: JSON.stringify({ descricao, valor, categoria_id: categoriaId, data }),
    });
    assert.equal(resultado.status, 201);
  };
  const resumo = async () => (await jsonFetch(baseUrl, '/api/resumo', { headers: autenticado })).corpo;

  // Só uma conta agendada para o dia 20: nada a extrapolar, entra uma vez só.
  await lancar('Escola', 900, '2026-11-20');
  let corpo = await resumo();
  assert.equal(corpo.projecaoMes, 900);
  assert.equal(corpo.projecaoPendente, false);

  // Gasto do dia a dia no dia 2: ainda não há dias suficientes para o ritmo.
  // Um mês anterior cheio de gastos não muda nada — vale só o mês corrente.
  await lancar('Outubro', 3100, '2026-10-15');
  await lancar('Mercado', 100, '2026-11-01');
  corpo = await resumo();
  assert.equal(corpo.totalGasto, 1000);
  assert.equal(corpo.projecaoMes, 0);
  assert.equal(corpo.projecaoPendente, true);
  assert.equal(corpo.diaInicioProjecao, 7);

  // Dia 10: 100 por dia no ritmo + a conta do dia 20 uma vez só.
  t.mock.timers.setTime(new Date('2026-11-10T15:00:00Z').getTime());
  autenticado = await entrar();
  await lancar('Feira', 900, '2026-11-09');
  corpo = await resumo();
  assert.equal(corpo.projecaoPendente, false);
  assert.equal(corpo.projecaoMes, 900 + 1000 + 100 * 20);
});
