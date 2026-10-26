const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-orcamento-rec-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';

const app = require('../src/server');
const db = require('../src/db');
const { obterOrcamentoDoMes } = require('../src/routes/orcamento');

async function jsonFetch(baseUrl, rota, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${rota}`, {
    ...opcoes,
    headers: { 'content-type': 'application/json', ...(opcoes.headers || {}) },
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

test('orçamento recorrente herda o último mês positivo ao virar o mês', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  const email = 'orcamento-rec@example.com';
  await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST', body: JSON.stringify({ nome: 'Recorrente', email, senha: 'senha123' }),
  });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);
  const login = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, senha: 'senha123' }),
  });
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };
  const usuario = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);

  // Sem recorrência: mês novo começa zerado, mas informa valorMesAnterior.
  db.prepare('INSERT INTO orcamento_mensal (usuario_id, mes, valor, valor_centavos) VALUES (?, ?, ?, ?)').run(
    usuario.id, '2026-08', 4500, 450000
  );
  const setembro = obterOrcamentoDoMes(usuario.id, '2026-09');
  assert.equal(setembro.valor, 0);
  assert.equal(setembro.recorrente, false);
  assert.equal(setembro.valorMesAnterior, 4500);

  // Ativar recorrência pela rota PUT /api/orcamento
  const putInvalido = await jsonFetch(baseUrl, '/api/orcamento', {
    method: 'PUT', headers: autenticado, body: JSON.stringify({ valor: 5000, recorrente: 'sim' }),
  });
  assert.equal(putInvalido.status, 400);

  const putOk = await jsonFetch(baseUrl, '/api/orcamento', {
    method: 'PUT', headers: autenticado, body: JSON.stringify({ valor: 5000, recorrente: true }),
  });
  assert.equal(putOk.status, 200);
  assert.equal(putOk.corpo.valor, 5000);
  assert.equal(putOk.corpo.recorrente, true);

  // Quando o mês seguinte abre pela primeira vez, já nasce com os 5000 herdados.
  const proximoMes = obterOrcamentoDoMes(usuario.id, '2099-01');
  assert.equal(proximoMes.valor, 5000);
  assert.equal(proximoMes.recorrente, true);
  assert.equal(proximoMes.valorMesAnterior, 5000);
});
