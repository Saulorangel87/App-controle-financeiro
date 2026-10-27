const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-recorrente-paga-'));
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

test('marcar conta recorrente como paga lança a despesa e desmarcar a remove', async (t) => {
  const servidor = http.createServer(app);
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    servidor.close();
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  const email = 'recorrente-paga@example.com';
  await jsonFetch(baseUrl, '/api/auth/registrar', {
    method: 'POST', body: JSON.stringify({ nome: 'Pagadora', email, senha: 'senha123' }),
  });
  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE email = ?').run(email);
  const login = await jsonFetch(baseUrl, '/api/auth/login', {
    method: 'POST', body: JSON.stringify({ email, senha: 'senha123' }),
  });
  const autenticado = { Authorization: `Bearer ${login.corpo.token}` };
  const categorias = (await jsonFetch(baseUrl, '/api/categorias', { headers: autenticado })).corpo;
  const moradia = categorias.find((c) => c.nome === 'Moradia');
  const hoje = hojeISO();

  const luz = (await jsonFetch(baseUrl, '/api/recorrentes', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ descricao: 'Conta de luz', valor: 150, dia_vencimento: 10 }),
  })).corpo;
  const geladeira = (await jsonFetch(baseUrl, '/api/recorrentes', {
    method: 'POST', headers: autenticado,
    body: JSON.stringify({ descricao: 'Geladeira', valor: 300, parcela_total: 10 }),
  })).corpo;

  const pagar = (id, corpo) => jsonFetch(baseUrl, `/api/recorrentes/${id}/pago`, {
    method: 'PATCH', headers: autenticado, body: JSON.stringify(corpo),
  });
  const despesasDoMes = async () => (await jsonFetch(baseUrl, `/api/despesas?mes=${hoje.slice(0, 7)}`, { headers: autenticado })).corpo;

  // Validação: categoria de outro usuário/inexistente, valor e data futura.
  let resultado = await pagar(luz.id, { pago: true, despesa: { valor: 150, categoria_id: 999999, data: hoje } });
  assert.equal(resultado.status, 400);
  resultado = await pagar(luz.id, { pago: true, despesa: { valor: 'cento e cinquenta', categoria_id: moradia.id, data: hoje } });
  assert.equal(resultado.status, 400);
  resultado = await pagar(luz.id, { pago: true, despesa: { valor: 150, categoria_id: moradia.id, data: '2999-01-01' } });
  assert.equal(resultado.status, 400);
  resultado = await pagar(luz.id, { pago: true, despesa: 'sim' });
  assert.equal(resultado.status, 400);
  assert.equal((await despesasDoMes()).length, 0, 'nenhuma tentativa inválida lança despesa');

  // O valor pago pode ser diferente do aproximado.
  resultado = await pagar(luz.id, {
    pago: true, despesa: { valor: 162.37, categoria_id: moradia.id, data: hoje, forma_pagamento: 'pix' },
  });
  assert.equal(resultado.status, 200);
  assert.equal(resultado.corpo.pago, true);
  assert.equal(resultado.corpo.categoria_id, moradia.id, 'categoria fica lembrada para o próximo mês');
  assert.equal(resultado.corpo.forma_pagamento, 'pix');
  assert.equal(resultado.corpo.despesa_lancada.valor, 162.37);
  assert.equal(resultado.corpo.despesa_paga_id, resultado.corpo.despesa_lancada.id);

  let despesas = await despesasDoMes();
  assert.deepEqual(despesas.map((d) => [d.descricao, d.valor, d.categoria_id, d.forma_pagamento]),
    [['Conta de luz', 162.37, moradia.id, 'pix']]);

  // Clique repetido não duplica.
  resultado = await pagar(luz.id, { pago: true, despesa: { valor: 162.37, categoria_id: moradia.id, data: hoje } });
  assert.equal(resultado.status, 200);
  assert.equal((await despesasDoMes()).length, 1);

  // A conta paga entra uma vez só na projeção do mês, não no ritmo diário.
  const resumo = (await jsonFetch(baseUrl, '/api/resumo', { headers: autenticado })).corpo;
  assert.equal(resumo.totalGasto, 162.37);
  assert.equal(resumo.projecaoMes, 162.37);

  // Prestação leva a parcela na descrição.
  resultado = await pagar(geladeira.id, { pago: true, despesa: { valor: 300, categoria_id: moradia.id, data: hoje } });
  assert.equal(resultado.corpo.despesa_lancada.descricao, 'Geladeira (1/10)');

  // Desmarcar remove só a despesa daquela conta e registra no histórico.
  resultado = await pagar(luz.id, { pago: false });
  assert.equal(resultado.corpo.pago, false);
  assert.equal(resultado.corpo.despesa_removida, true);
  assert.equal(resultado.corpo.despesa_paga_id, null);
  despesas = await despesasDoMes();
  assert.deepEqual(despesas.map((d) => d.descricao), ['Geladeira (1/10)']);
  const historico = db.prepare(
    "SELECT acao FROM historico_alteracoes WHERE tabela = 'despesas' ORDER BY id"
  ).all().map((h) => h.acao);
  assert.deepEqual(historico, ['criar', 'criar', 'excluir']);

  // Pagar sem lançar despesa continua funcionando como antes.
  resultado = await pagar(luz.id, { pago: true });
  assert.equal(resultado.corpo.pago, true);
  assert.equal(resultado.corpo.despesa_lancada, null);
  assert.equal(resultado.corpo.categoria_id, moradia.id, 'pagar sem lançar não esquece a categoria');
  assert.equal((await despesasDoMes()).length, 1);

  // Se a despesa lançada for excluída na tela de despesas, a conta continua paga.
  const idGeladeira = despesas[0].id;
  await jsonFetch(baseUrl, `/api/despesas/${idGeladeira}`, { method: 'DELETE', headers: autenticado });
  const lista = (await jsonFetch(baseUrl, '/api/recorrentes', { headers: autenticado })).corpo;
  const geladeiraAtual = lista.itens.find((i) => i.id === geladeira.id);
  assert.equal(geladeiraAtual.pago, true);
  assert.equal(geladeiraAtual.despesa_paga_id, null);
  resultado = await pagar(geladeira.id, { pago: false });
  assert.equal(resultado.corpo.despesa_removida, false);
});

test('pagamento do mês anterior não é apagado ao desmarcar a conta deste mês', () => {
  const { comCamposCalculados } = require('../src/routes/recorrentes');
  const conta = { id: 1, valor: 80, pago_mes: '2026-09', pago_em: null, despesa_paga_id: 7 };
  assert.equal(comCamposCalculados(conta, '2026-09').despesa_paga_id, 7);
  assert.equal(comCamposCalculados(conta, '2026-10').despesa_paga_id, null);
});
