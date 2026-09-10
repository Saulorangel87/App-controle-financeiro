const Database = require('better-sqlite3');
const path = require('path');
const { paraCentavos, deCentavos } = require('../utils/dinheiro');

const caminhoBanco = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'despesas.db');
const tabelas = [
  ['categorias', 'limite'],
  ['despesas', 'valor'],
  ['orcamento', 'valor'],
  ['orcamento_mensal', 'valor'],
  ['entradas', 'valor'],
  ['despesas_recorrentes', 'valor'],
];

function simular() {
  const db = new Database(caminhoBanco, { readonly: true, fileMustExist: true });
  try {
    return tabelas.map(([tabela, coluna]) => {
      const valores = db.prepare(`SELECT ${coluna} AS valor FROM ${tabela} WHERE ${coluna} IS NOT NULL`).all();
      const totalReais = valores.reduce((soma, linha) => soma + Number(linha.valor), 0);
      const totalCentavos = valores.reduce((soma, linha) => soma + paraCentavos(Number(linha.valor)), 0);
      const totalConvertido = deCentavos(totalCentavos);

      return {
        tabela,
        coluna,
        registros: valores.length,
        totalAtualReais: Number(totalReais.toFixed(2)),
        totalConvertidoReais: Number(totalConvertido.toFixed(2)),
        totalCentavos,
        diferencaCentavos: totalCentavos - paraCentavos(totalReais),
      };
    });
  } finally {
    db.close();
  }
}

try {
  console.log(JSON.stringify({ banco: caminhoBanco, somenteLeitura: true, tabelas: simular() }, null, 2));
} catch (erro) {
  console.error(`Falha ao simular migração: ${erro.message}`);
  process.exitCode = 1;
}

