const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pastaTemporaria = fs.mkdtempSync(path.join(os.tmpdir(), 'controle-despesas-vencimentos-test-'));
process.env.DB_PATH = path.join(pastaTemporaria, 'despesas.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.NODE_ENV = 'test';
process.env.APP_TIMEZONE = 'America/Sao_Paulo';

// Substitui o serviço de push por um falso que só registra o que seria enviado.
const enviados = [];
const caminhoPush = require.resolve('../src/services/push');
require.cache[caminhoPush] = {
  id: caminhoPush, filename: caminhoPush, loaded: true,
  exports: {
    pushConfigurado: () => true,
    enviarPush: async (inscricao, payload) => { enviados.push({ inscricao: inscricao.id, ...payload }); return true; },
  },
};

const db = require('../src/db');
const { executar, contextoHoje, proximoVencimento } = require('../src/jobs/notificarVencimentos');

// 12:00 UTC = 09:00 em São Paulo, mesmo horário do timer em produção.
const em = (data) => new Date(`${data}T12:00:00Z`);
const vencimento = (dia, data) => proximoVencimento(dia, contextoHoje(em(data)));
const diasAte = (dia, data) => vencimento(dia, data).dias;

test('conta dias até o vencimento dentro do mês', () => {
  assert.equal(diasAte(6, '2026-10-03'), 3);
  assert.equal(diasAte(4, '2026-10-03'), 1);
  assert.equal(diasAte(3, '2026-10-03'), 0);
});

test('vencimentos no início do mês avisam no fim do mês anterior', () => {
  assert.deepEqual(vencimento(1, '2026-09-28'), { dias: 3, ano: 2026, mesNumero: 10, mes: '2026-10' });
  assert.equal(diasAte(1, '2026-09-30'), 1);
  assert.equal(diasAte(2, '2026-09-29'), 3);
  assert.equal(diasAte(3, '2026-09-30'), 3);
});

test('virada de ano e mês curto', () => {
  assert.deepEqual(vencimento(1, '2026-12-29'), { dias: 3, ano: 2027, mesNumero: 1, mes: '2027-01' });
  // Dia 31 em fevereiro vence no último dia do mês.
  assert.equal(diasAte(31, '2027-02-27'), 1);
  assert.equal(diasAte(30, '2027-02-25'), 3);
});

test('envia avisos de 3 e 1 dia, inclusive na virada de mês, sem duplicar', async (t) => {
  t.after(() => {
    db.close();
    fs.rmSync(pastaTemporaria, { recursive: true, force: true });
  });

  const usuario = db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, email_verificado) VALUES ('u', 'u@example.com', 'hash', 1)
  `).run().lastInsertRowid;
  const inscricao = db.prepare(`
    INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth) VALUES (?, 'https://push.example.com/abc', 'k', 'a')
  `).run(usuario).lastInsertRowid;
  const criar = (descricao, dia, pagoMes = null) => db.prepare(`
    INSERT INTO despesas_recorrentes (usuario_id, descricao, valor, dia_vencimento, pago_mes) VALUES (?, ?, 10, ?, ?)
  `).run(usuario, descricao, dia, pagoMes).lastInsertRowid;

  const aluguel = criar('Aluguel', 1);
  const internet = criar('Internet', 1);
  criar('Luz', 1, '2026-10'); // já paga para o vencimento de outubro

  assert.equal(await executar(em('2026-09-28')), 2);
  assert.deepEqual(enviados.map((e) => e.tag).sort(), [`vencimento-recorrente-${aluguel}`, `vencimento-recorrente-${internet}`].sort());
  assert.ok(enviados.every((e) => e.inscricao === inscricao && e.titulo === 'Despesa vencendo em 3 dias'));

  // Rodar de novo no mesmo dia não reenvia.
  assert.equal(await executar(em('2026-09-28')), 0);

  enviados.length = 0;
  assert.equal(await executar(em('2026-09-30')), 2);
  assert.ok(enviados.every((e) => e.titulo === 'Despesa vencendo amanhã'));
});
