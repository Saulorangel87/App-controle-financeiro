const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Caminho do arquivo do banco. Em produção (Docker), isso vai apontar
// para um volume montado, então os dados sobrevivem a rebuilds do container.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'despesas.db');

// Garante que a pasta do banco existe
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Aplica o schema (é idempotente por causa do IF NOT EXISTS)
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migração idempotente: adiciona a coluna email_verificado se ainda não
// existir. SQLite não tem "ADD COLUMN IF NOT EXISTS", então checamos na mão
// via PRAGMA. O DEFAULT 1 preenche automaticamente todas as contas que já
// existiam ANTES dessa coluna existir — ninguém que já usava o app fica
// bloqueado do nada. Só cadastros novos, feitos a partir daqui, começam
// como não-verificados (o INSERT em /auth/registrar passa 0 explicitamente).
const colunasUsuarios = db.prepare('PRAGMA table_info(usuarios)').all();
const temColunaVerificado = colunasUsuarios.some((c) => c.name === 'email_verificado');
if (!temColunaVerificado) {
  db.exec('ALTER TABLE usuarios ADD COLUMN email_verificado INTEGER NOT NULL DEFAULT 1');
}

// Migração idempotente: a tabela "orcamento" (um valor fixo por usuário,
// sem mês) foi substituída por "orcamento_mensal" (um valor por usuário
// POR MÊS, pra resetar sozinha quando o mês vira). Pra quem já tinha um
// valor definido na tabela antiga, essa migração carrega esse valor pro
// mês corrente em orcamento_mensal, preservando o que a pessoa já via na
// tela — só não se repete nos meses seguintes, que é justamente o objetivo.
// Roda só uma vez: se orcamento_mensal já tem qualquer linha, não faz nada.
const jaMigrado = db.prepare('SELECT 1 FROM orcamento_mensal LIMIT 1').get();
if (!jaMigrado) {
  const mesAtual = db.prepare(`SELECT strftime('%Y-%m', 'now') AS mes`).get().mes;
  const antigos = db.prepare('SELECT usuario_id, valor FROM orcamento WHERE valor > 0').all();
  const inserir = db.prepare(`
    INSERT OR IGNORE INTO orcamento_mensal (usuario_id, mes, valor) VALUES (?, ?, ?)
  `);
  for (const { usuario_id, valor } of antigos) {
    inserir.run(usuario_id, mesAtual, valor);
  }
}

module.exports = db;
