// Valores monetários devem ser convertidos para centavos antes de operações
// aritméticas persistentes. A conversão usa arredondamento explícito para
// evitar resultados inesperados da representação binária de números decimais.
function paraCentavos(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError('valor monetário precisa ser um número finito');
  }
  const sinal = Math.sign(valor) || 1;
  return sinal * Math.round((Math.abs(valor) + Number.EPSILON) * 100);
}

function deCentavos(centavos) {
  if (!Number.isInteger(centavos) || !Number.isSafeInteger(centavos)) {
    throw new TypeError('centavos precisa ser um inteiro seguro');
  }
  return centavos / 100;
}

function comValorEmReais(linha, coluna = 'valor') {
  const colunaCentavos = `${coluna}_centavos`;
  const { [colunaCentavos]: centavos, ...resto } = linha;
  return {
    ...resto,
    [coluna]: Number.isInteger(centavos) ? deCentavos(centavos) : Number(linha[coluna]),
  };
}

module.exports = { paraCentavos, deCentavos, comValorEmReais };
