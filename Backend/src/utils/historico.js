const db = require('../db');

// Registra uma linha no histórico de alterações. "antes"/"depois" são o
// registro inteiro (ou null, quando não se aplica: criar não tem "antes",
// excluir não tem "depois"), serializados como JSON pra consulta futura.
function registrar(usuarioId, tabela, registroId, acao, antes, depois) {
  db.prepare(`
    INSERT INTO historico_alteracoes (usuario_id, tabela, registro_id, acao, dados_antes, dados_depois)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    usuarioId,
    tabela,
    registroId,
    acao,
    antes ? JSON.stringify(antes) : null,
    depois ? JSON.stringify(depois) : null
  );
}

module.exports = { registrar };
