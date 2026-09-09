const test = require('node:test');
const assert = require('node:assert/strict');
const { numeroMonetarioValido, dataISOValida } = require('../src/utils/validacao');

test('aceita valores monetários finitos e positivos', () => {
  assert.equal(numeroMonetarioValido(10.5), true);
  assert.equal(numeroMonetarioValido(0), false);
  assert.equal(numeroMonetarioValido(0, true), true);
  assert.equal(numeroMonetarioValido('10.5'), false);
  assert.equal(numeroMonetarioValido(Number.NaN), false);
});

test('valida datas no formato ISO e rejeita datas impossíveis', () => {
  assert.equal(dataISOValida('2026-09-09'), true);
  assert.equal(dataISOValida('2026-02-30'), false);
  assert.equal(dataISOValida('09/09/2026'), false);
  assert.equal(dataISOValida(20260909), false);
});
