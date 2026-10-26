const db = require('./index');

// Sessões trocadas numa renovação ficam guardadas só pela tolerância de reuso
// (30 s, ver routes/auth.js); um dia de folga cobre relógio e requisições
// lentas com sobra. Sem esta limpeza a tabela só crescia: cada renovação
// (a cada 15 min de uso) deixava uma linha revogada para sempre.
const MARGEM_SESSAO_TROCADA_MS = 24 * 60 * 60 * 1000;

// expira_em/rotacionada_em são gravados com toISOString(), então a comparação
// precisa ser feita com o mesmo formato (o datetime('now') do SQLite usa
// espaço no lugar do "T" e daria resultado errado na comparação de texto).
function limiteSessaoTrocada(agora) {
  return new Date(agora.getTime() - MARGEM_SESSAO_TROCADA_MS).toISOString();
}

// Apaga sessões expiradas, encerradas por logout (revogadas sem rotação) e
// trocadas há mais de um dia. Com usuarioId, limpa só as daquela pessoa.
function limparSessoes(usuarioId = null, agora = new Date()) {
  const filtroUsuario = usuarioId === null ? '' : 'usuario_id = ? AND';
  const parametros = usuarioId === null ? [] : [usuarioId];
  return db.prepare(`
    DELETE FROM sessoes
    WHERE ${filtroUsuario} (
      expira_em < ?
      OR (revogada = 1 AND (rotacionada_em IS NULL OR rotacionada_em < ?))
    )
  `).run(...parametros, agora.toISOString(), limiteSessaoTrocada(agora)).changes;
}

// Tokens de verificação de email e de recuperação de senha já usados ou vencidos.
function limparTokens(agora = new Date()) {
  return db.prepare('DELETE FROM tokens WHERE usado = 1 OR expira_em < ?')
    .run(agora.toISOString()).changes;
}

module.exports = { limparSessoes, limparTokens };
