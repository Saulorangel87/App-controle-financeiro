const test = require('node:test');
const assert = require('node:assert/strict');

const { paraCentavos, deCentavos } = require('../src/utils/dinheiro');

test('converte valores em reais para centavos com arredondamento explícito', () => {
  assert.equal(paraCentavos(10), 1000);
  assert.equal(paraCentavos(10.99), 1099);
  assert.equal(paraCentavos(0.1 + 0.2), 30);
  assert.equal(paraCentavos(10.995), 1100);
  assert.equal(paraCentavos(-10.995), -1100);
});

test('converte centavos para reais', () => {
  assert.equal(deCentavos(1099), 10.99);
  assert.equal(deCentavos(0), 0);
});

test('rejeita valores que não podem representar dinheiro com segurança', () => {
  assert.throws(() => paraCentavos(Number.NaN), TypeError);
  assert.throws(() => paraCentavos('10.99'), TypeError);
  assert.throws(() => deCentavos(10.5), TypeError);
});
