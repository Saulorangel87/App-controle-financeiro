const test = require('node:test');
const assert = require('node:assert/strict');

const { diferencaMeses, comCamposCalculados } = require('../src/routes/recorrentes');

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
