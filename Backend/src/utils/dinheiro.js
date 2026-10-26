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

// Como comValorEmReais, mas pra colunas opcionais que não têm um espelho em
// reais (ex: divisao_valor_centavos) — null quando não há valor, em vez de
// NaN ou de exigir uma coluna REAL só pra isso.
function centavosOuNulo(centavos) {
  return Number.isInteger(centavos) ? deCentavos(centavos) : null;
}

// Soma de uma coluna monetária em SQL, já em reais. Soma os centavos inteiros
// e divide uma vez só, no fim — somar valores já divididos por 100 acumulava
// erro de ponto flutuante. Linhas antigas sem *_centavos usam o valor decimal.
// prefixo é o apelido da tabela na consulta (ex: 'd' → d.valor_centavos).
function somaEmReaisSQL(prefixo = '', coluna = 'valor') {
  const p = prefixo ? `${prefixo}.` : '';
  return `COALESCE(SUM(COALESCE(${p}${coluna}_centavos, ROUND(${p}${coluna} * 100))), 0) / 100.0`;
}

module.exports = { paraCentavos, deCentavos, comValorEmReais, centavosOuNulo, somaEmReaisSQL };
