const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-orcamento-mensal-'));
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

test('saldo do mês passa para o mês seguinte, inclusive negativo', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  const email = 'orcamento-mensal@example.com';
  await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST', body: JSON.stringify({ nome: 'Orçamento', email, senha: 'senha123' }),
  });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);
  const login = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, senha: 'senha123' }),
  });
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };
  const usuario = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  const categoriaId = (await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado })).corpo[0].id;
  const lancarDespesa = (valor, data) => jsonFetch(baseUrl, '/api/despesas', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ descricao: 'Gasto', valor, categoria_id: categoriaId, data }),
  });
  const lancarEntrada = (valor, data) => jsonFetch(baseUrl, '/api/entradas', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ origem: 'Salário', valor, data }),
  });
  const resumo = async (mes) => (await jsonFetch(baseUrl, `/api/resumo?mes=${mes}`, { headers: autenticado })).corpo;

  // Gastos de antes do primeiro orçamento não viram saldo negativo.
  await lancarDespesa(999, '2026-09-10');
  // Sobras de antes de outubro/2026 (quando o saldo acumulado começou) não
  // contam: agosto teve 5000 de orçamento e nenhum gasto.
  db.prepare('INSERT INTO orcamento_mensal (usuario_id, mes, valor, valor_centavos) VALUES (?, ?, ?, ?)').run(
    usuario.id, '2026-08', 5000, 500000
  );

  // Outubro: entrou 3000, gastou 2000 → sobram 1000.
  await lancarEntrada(3000, '2026-10-05');
  await lancarDespesa(2000, '2026-10-10');
  let corpo = await resumo('2026-10');
  assert.equal(corpo.saldoAnterior, 0);
  assert.equal(corpo.orcamentoTotal, 3000);
  assert.equal(corpo.disponivel, 1000);

  // Novembro: o saldo de 1000 continua; o salário de 2000 soma por cima.
  corpo = await resumo('2026-11');
  assert.equal(corpo.saldoAnterior, 1000);
  assert.equal(corpo.orcamentoTotal, 1000, 'o mês novo não zera');
  await lancarEntrada(2000, '2026-11-05');
  corpo = await resumo('2026-11');
  assert.equal(corpo.orcamentoDoMes, 2000);
  assert.equal(corpo.orcamentoTotal, 3000);

  // Novembro gasta 3500 → fecha em −500, e dezembro começa devendo.
  await lancarDespesa(3500, '2026-11-20');
  corpo = await resumo('2026-12');
  assert.equal(corpo.saldoAnterior, -500);
  await lancarEntrada(2000, '2026-12-05');
  corpo = await resumo('2026-12');
  assert.equal(corpo.orcamentoTotal, 1500);
  assert.equal(obterOrcamentoDoMes(usuario.id, '2026-12').valor, 1500);

  // Corrigir uma despesa de outubro corrige o saldo dos meses seguintes.
  const despesaOutubro = db.prepare("SELECT id FROM despesas WHERE usuario_id = ? AND data = '2026-10-10'").get(usuario.id);
  let resultado = await jsonFetch(baseUrl, `/api/despesas/${despesaOutubro.id}`, {
    method: 'PUT', headers: autenticado,
    body: JSON.stringify({ descricao: 'Gasto', valor: 1800, categoria_id: categoriaId, data: '2026-10-10' }),
  });
  assert.equal(resultado.status, 200);
  assert.equal((await resumo('2026-12')).orcamentoTotal, 1700);

  // "Editar" define o total do mês; o que fica guardado é total − saldo.
  resultado = await jsonFetch(baseUrl, '/api/orcamento?mes=2026-12', {
    method: 'PUT', headers: autenticado, body: JSON.stringify({ valor: 1600 }),
  });
  assert.equal(resultado.status, 200);
  assert.equal(resultado.corpo.valor, 1600);
  assert.equal(resultado.corpo.saldoAnterior, -300);
  assert.equal(resultado.corpo.valorDoMes, 1900);

  // Janeiro herda o saldo de dezembro (1600, sem gastos).
  corpo = await resumo('2027-01');
  assert.equal(corpo.saldoAnterior, 1600);
  assert.equal(corpo.orcamentoTotal, 1600);

  // O "copiar mês anterior" não existe mais.
  const copiar = await fetch(`${baseUrl}/api/orcamento/copiar-anterior?mes=2027-01`, {
    method: 'POST', headers: autenticado,
  });
  assert.equal(copiar.status, 404);
});
