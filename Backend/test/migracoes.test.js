const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const Database = require('better-sqlite3');

const RAIZ_BACKEND = path.join(__dirname, '..');

// Simula o banco de alguém que instalou o app bem antes das migrações mais
// recentes existirem: só usuarios (sem email_verificado/ultimo_login) e a
// tabela orcamento antiga (sem orcamento_mensal), com um valor definido —
// exatamente o cenário que a migração automática do db/index.js precisa
// resolver sozinha na primeira subida do backend.
function criarBancoAntigo(caminho) {
  const db = new Database(caminho);
  db.exec(`
    CREATE TABLE usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE orcamento (
      usuario_id INTEGER PRIMARY KEY,
      valor REAL NOT NULL DEFAULT 0,
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO usuarios (nome, email, senha_hash) VALUES ('Migração Teste', 'migracao@example.com', 'hash-qualquer');
    INSERT INTO orcamento (usuario_id, valor) VALUES (1, 100);
  `);
  db.close();
}

// Roda as migrações do jeito que o servidor real roda: como efeito colateral
// de "require('./src/db')". Um processo novo por chamada garante que o
// require não fica em cache — a segunda chamada precisa migrar do zero de
// novo, validando que todas as migrações são idempotentes.
function rodarMigracoes(dbPath) {
  execFileSync(process.execPath, ['-e', "require('./src/db')"], {
    cwd: RAIZ_BACKEND,
    env: { ...process.env, DB_PATH: dbPath },
  });
}

test('migrações de schema são idempotentes e preservam dados pré-existentes', () => {
  const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-migracoes-test-'));
  const dbPath = path.join(pastaTemporaria, 'despesas.db');

  try {
    criarBancoAntigo(dbPath);

    rodarMigracoes(dbPath);
    rodarMigracoes(dbPath); // idempotência: não pode lançar erro na segunda vez

    const db = new Database(dbPath);
    try {
      const colunas = (tabela) => db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name);

      assert.ok(colunas('usuarios').includes('email_verificado'));
      assert.ok(colunas('usuarios').includes('ultimo_login'));
      assert.ok(colunas('despesas_recorrentes').includes('parcela_total'));
      assert.ok(colunas('despesas_recorrentes').includes('parcela_mes_inicio'));
      assert.ok(colunas('despesas').includes('dividida_com'));
      assert.ok(colunas('despesas').includes('divisao_valor_centavos'));

      // Migração one-shot orcamento -> orcamento_mensal: o valor antigo
      // aparece uma vez só no mês corrente, sem duplicar na segunda rodada.
      const mesAtual = db.prepare("SELECT strftime('%Y-%m', 'now') AS mes").get().mes;
      const linhasOrcamentoMensal = db.prepare(
        'SELECT valor FROM orcamento_mensal WHERE usuario_id = 1 AND mes = ?'
      ).all(mesAtual);
      assert.equal(linhasOrcamentoMensal.length, 1);
      assert.equal(linhasOrcamentoMensal[0].valor, 100);

      // Backfill de ultimo_login não deixa ninguém "inativo" no primeiro dia.
      const usuario = db.prepare('SELECT ultimo_login FROM usuarios WHERE id = 1').get();
      assert.ok(usuario.ultimo_login);
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  }
});
