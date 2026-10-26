const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-limpeza-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.NODE_ENV = 'test';

const db = require('../src/db');
const { limparSessoes, limparTokens } = require('../src/db/limpeza');

const agora = new Date('2026-10-26T12:00:00.000Z');
const iso = (horas) => new Date(agora.getTime() + horas * 60 * 60 * 1000).toISOString();

test('limpeza apaga só sessões e tokens que não servem mais', (t) => {
  t.after(() => {
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });

  for (const email of ['a@example.com', 'b@example.com']) {
    db.prepare("INSERT INTO usuarios (nome, email, senha_hash) VALUES ('X', ?, 'h')").run(email);
  }
  const sessao = db.prepare(`
    INSERT INTO sessoes (usuario_id, token_hash, expira_em, revogada, rotacionada_em)
    VALUES (?, ?, ?, ?, ?)
  `);
  sessao.run(1, 'ativa', iso(24 * 30), 0, null);
  sessao.run(1, 'trocada-agora', iso(24 * 30), 1, iso(0)); // ainda na tolerância de reuso
  sessao.run(1, 'trocada-ontem', iso(24 * 30), 1, iso(-25));
  sessao.run(1, 'logout', iso(24 * 30), 1, null);
  sessao.run(1, 'expirada', iso(-1), 0, null);
  sessao.run(2, 'logout-de-b', iso(24 * 30), 1, null);

  // Por usuário: não mexe nas sessões da outra pessoa.
  assert.equal(limparSessoes(1, agora), 3);
  const restantes = () => db.prepare('SELECT token_hash FROM sessoes ORDER BY id').all().map((s) => s.token_hash);
  assert.deepEqual(restantes(), ['ativa', 'trocada-agora', 'logout-de-b']);

  assert.equal(limparSessoes(null, agora), 1);
  assert.deepEqual(restantes(), ['ativa', 'trocada-agora']);

  const token = db.prepare('INSERT INTO tokens (usuario_id, token, tipo, expira_em, usado) VALUES (1, ?, ?, ?, ?)');
  token.run('valido', 'recuperacao_senha', iso(1), 0);
  token.run('usado', 'verificacao_email', iso(10), 1);
  token.run('vencido', 'verificacao_email', iso(-1), 0);
  assert.equal(limparTokens(agora), 2);
  assert.deepEqual(db.prepare('SELECT token FROM tokens').all().map((r) => r.token), ['valido']);
});
