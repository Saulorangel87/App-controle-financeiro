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

module.exports = db;
