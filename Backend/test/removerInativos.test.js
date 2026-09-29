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
const { executar, DIAS_INATIVIDADE, DIAS_AVISO } = require('../src/jobs/removerInativos');

function dataHaDias(dias) {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

function criarUsuario(email, diasSemLogin, diasDesdeAviso = null) {
  return db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, email_verificado, ultimo_login, aviso_inatividade_em)
    VALUES (?, ?, 'hash-qualquer', 1, ?, ?)
  `).run(email, email, dataHaDias(diasSemLogin), diasDesdeAviso === null ? null : dataHaDias(diasDesdeAviso)).lastInsertRowid;
}

const existe = (id) => db.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE id = ?').get(id).n === 1;
const aviso = (id) => db.prepare('SELECT aviso_inatividade_em AS a FROM usuarios WHERE id = ?').get(id).a;

test('avisa quem está a 7 dias do limite e só remove quem já foi avisado', async (t) => {
  t.after(() => {
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });

  const recente = criarUsuario('recente@example.com', 1);
  const perto = criarUsuario('perto@example.com', DIAS_INATIVIDADE - DIAS_AVISO + 1);
  const vencidoSemAviso = criarUsuario('vencido-sem-aviso@example.com', DIAS_INATIVIDADE + 5);
  const vencidoAvisadoRecente = criarUsuario('avisado-recente@example.com', DIAS_INATIVIDADE + 5, 2);
  const vencidoAvisado = criarUsuario('avisado-antigo@example.com', DIAS_INATIVIDADE + 10, DIAS_AVISO + 1);

  const resultado = await executar();

  // "perto" e "vencidoSemAviso" recebem aviso agora.
  assert.equal(resultado.avisados, 2);
  assert.ok(aviso(perto));
  assert.ok(aviso(vencidoSemAviso));
  assert.equal(aviso(recente), null);

  // Só quem passou dos 90 dias E foi avisado há 7+ dias é removido.
  assert.equal(resultado.removidos, 1);
  assert.equal(existe(vencidoAvisado), false);
  assert.equal(existe(vencidoSemAviso), true);
  assert.equal(existe(vencidoAvisadoRecente), true);
  assert.equal(existe(perto), true);
  assert.equal(existe(recente), true);

  // Rodar de novo no mesmo dia não reenvia avisos nem remove mais ninguém.
  const segunda = await executar();
  assert.deepEqual(segunda, { avisados: 0, removidos: 0 });
});
