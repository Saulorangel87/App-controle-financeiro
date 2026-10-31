const test = require('node:test');
const assert = require('node:assert/strict');

const { diferencaMeses, comCamposCalculados, alertaVencimento } = require('../src/routes/recorrentes');

test('calcula corretamente a diferença entre meses e anos', () => {
  assert.equal(diferencaMeses('2026-08', '2026-08'), 0);
  assert.equal(diferencaMeses('2026-08', '2026-09'), 1);
  assert.equal(diferencaMeses('2025-12', '2026-02'), 2);
});

test('pagamento vale somente no mês em que foi marcado', () => {
  const despesa = {
    id: 1,
    valor: 80,
    pago_mes: '2026-09',
    pago_em: '2026-09-10T12:00:00.000Z',
    parcela_total: null,
    parcela_mes_inicio: null,
  };

  assert.equal(comCamposCalculados(despesa, '2026-09').pago, true);
  assert.equal(comCamposCalculados(despesa, '2026-10').pago, false);
});

test('parcela avança na virada do mês e conclui após a última', () => {
  const despesa = {
    id: 2,
    valor: 200,
    pago_mes: null,
    pago_em: null,
    parcela_total: 3,
    parcela_mes_inicio: '2026-09',
  };

  assert.equal(comCamposCalculados(despesa, '2026-09').parcela_atual, 1);
  assert.equal(comCamposCalculados(despesa, '2026-10').parcela_atual, 2);
  assert.equal(comCamposCalculados(despesa, '2026-11').parcela_atual, 3);

  const concluida = comCamposCalculados(despesa, '2026-12');
  assert.equal(concluida.parcela_atual, 3);
  assert.equal(concluida.parcela_concluida, true);
});

test('gera alertas de vencimento em 3, 1 e 0 dias, mas ignora contas pagas', () => {
  const hoje = new Date('2026-09-10T12:00:00.000Z');
  assert.equal(alertaVencimento(13, false, false, hoje).nivel, 'atencao');
  assert.equal(alertaVencimento(11, false, false, hoje).nivel, 'urgente');
  assert.equal(alertaVencimento(10, false, false, hoje).texto, 'Vence hoje');
  assert.equal(alertaVencimento(9, false, false, hoje).nivel, 'vencida');
  assert.equal(alertaVencimento(10, true, false, hoje), null);
  assert.equal(alertaVencimento(10, false, true, hoje), null);

  // 23h de 09/09 em Brasília já é 10/09 em UTC: o dia 10 ainda é "amanhã".
  assert.equal(alertaVencimento(10, false, false, new Date('2026-09-10T02:00:00.000Z')).texto, 'Vence amanhã');
  // Setembro tem 30 dias: vencimento no dia 31 cai no dia 30.
  assert.equal(alertaVencimento(31, false, false, new Date('2026-09-29T12:00:00.000Z')).texto, 'Vence amanhã');
});

test('alerta de vencimento segue o mês escolhido no seletor', () => {
  const hoje = new Date('2026-10-31T12:00:00.000Z');
  assert.equal(alertaVencimento(5, false, false, hoje, '2026-11'), null, 'novembro ainda não venceu');
  assert.equal(alertaVencimento(5, false, false, hoje, '2026-09').texto, 'Vencida');
  assert.equal(alertaVencimento(5, true, false, hoje, '2026-09'), null);
});
