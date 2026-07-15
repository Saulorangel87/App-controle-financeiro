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

module.exports = db;
