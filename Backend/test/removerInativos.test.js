const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-inativos-test-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = '';

const db = require('../src/db');
const { executar, DIAS_INATIVIDADE } = require('../src/jobs/removerInativos');

function criarUsuario(email, ultimoLogin) {
  const info = db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, email_verificado, ultimo_login)
    VALUES (?, ?, 'hash-qualquer', 1, ?)
  `).run(email, email, ultimoLogin);
  return info.lastInsertRowid;
}

function dataHaDias(dias) {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

test('remove contas sem login há mais de 90 dias e preserva as recentes', async (t) => {
  t.after(() => {
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });

  const idInativo = criarUsuario('inativo@example.com', dataHaDias(DIAS_INATIVIDADE + 1));
  const idRecente = criarUsuario('recente@example.com', dataHaDias(1));

  const removidos = await executar();

  assert.equal(removidos, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM usuarios WHERE id = ?').get(idInativo).total, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM usuarios WHERE id = ?').get(idRecente).total, 1);
});
