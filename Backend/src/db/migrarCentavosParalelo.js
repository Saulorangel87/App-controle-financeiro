const Database = require('better-sqlite3');
const path = require('path');
const { paraCentavos } = require('../utils/dinheiro');

const caminhoBanco = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'despesas.db');
const colunas = [
  ['categorias', 'limite', 'limite_centavos'],
  ['despesas', 'valor', 'valor_centavos'],
  ['orcamento', 'valor', 'valor_centavos'],
  ['orcamento_mensal', 'valor', 'valor_centavos'],
  ['entradas', 'valor', 'valor_centavos'],
  ['despesas_recorrentes', 'valor', 'valor_centavos'],
];

function temColuna(db, tabela, coluna) {
  return db.prepare(`PRAGMA table_info(${tabela})`).all().some((item) => item.name === coluna);
}

function migrar() {
  const db = new Database(caminhoBanco);
  const resultado = [];

  try {
    const executar = db.transaction(() => {
      for (const [tabela, coluna, colunaCentavos] of colunas) {
        if (!temColuna(db, tabela, colunaCentavos)) {
          db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${colunaCentavos} INTEGER`);
        }

        const linhas = db.prepare(`SELECT rowid AS _rowid, ${coluna} AS valor, ${colunaCentavos} AS centavos FROM ${tabela}`).all();
        const atualizar = db.prepare(`UPDATE ${tabela} SET ${colunaCentavos} = ? WHERE rowid = ?`);
        let preenchidos = 0;
        let divergencias = 0;

        for (const linha of linhas) {
          const esperado = linha.valor === null ? null : paraCentavos(Number(linha.valor));
          if (linha.centavos !== esperado) divergencias += 1;
          if (linha.centavos === null && esperado !== null) {
            atualizar.run(esperado, linha._rowid);
            preenchidos += 1;
          }
        }

        resultado.push({ tabela, coluna, colunaCentavos, registros: linhas.length, preenchidos, divergencias });
      }
    });

    executar();
    return resultado;
  } finally {
    db.close();
  }
}

try {
  console.log(JSON.stringify({ banco: caminhoBanco, migracao: 'paralela', resultado: migrar() }, null, 2));
} catch (erro) {
  console.error(`Falha na migração paralela: ${erro.message}`);
  process.exitCode = 1;
}
