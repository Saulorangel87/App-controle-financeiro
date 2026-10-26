const db = require('../db');
const { limparSessoes, limparTokens } = require('../db/limpeza');
const { enviarEmailAvisoInatividade, enviarEmailContaRemovida } = require('../services/email');

const DIAS_INATIVIDADE = 90;
const DIAS_AVISO = 7;

// Duas etapas, rodando todo dia:
// 1) avisa por email quem está a DIAS_AVISO dias de completar a inatividade
//    (só marca como avisado se o envio funcionar — senão tenta de novo no dia seguinte);
// 2) remove quem passou de DIAS_INATIVIDADE E já foi avisado há pelo menos
//    DIAS_AVISO dias. Ninguém é apagado sem ter sido avisado, mesmo que o
//    job fique parado alguns dias. O cascade do banco (ON DELETE CASCADE)
//    apaga sozinho todos os dados dependentes.
async function executar() {
  const paraAvisar = db.prepare(`
    SELECT id, email FROM usuarios
    WHERE ultimo_login < datetime('now', ?) AND aviso_inatividade_em IS NULL
  `).all(`-${DIAS_INATIVIDADE - DIAS_AVISO} days`);

  let avisados = 0;
  for (const usuario of paraAvisar) {
    try {
      await enviarEmailAvisoInatividade(usuario.email, DIAS_AVISO);
      db.prepare("UPDATE usuarios SET aviso_inatividade_em = datetime('now') WHERE id = ?").run(usuario.id);
      avisados += 1;
    } catch {
      // Falha de envio: não marca, o próximo ciclo tenta de novo.
    }
  }

  const paraRemover = db.prepare(`
    SELECT id, email FROM usuarios
    WHERE ultimo_login < datetime('now', ?)
      AND aviso_inatividade_em IS NOT NULL
      AND aviso_inatividade_em <= datetime('now', ?)
  `).all(`-${DIAS_INATIVIDADE} days`, `-${DIAS_AVISO} days`);

  for (const usuario of paraRemover) {
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(usuario.id);
    try {
      await enviarEmailContaRemovida(usuario.email);
    } catch {
      // A remoção já aconteceu; o email de confirmação é best-effort.
    }
  }

  // Faxina diária de quem não renova sessão há tempo (as renovações já limpam
  // as sessões de quem usa o app) e dos tokens de email usados ou vencidos.
  const sessoesApagadas = limparSessoes();
  const tokensApagados = limparTokens();

  console.log(`Inativos: ${avisados} aviso(s) enviado(s), ${paraRemover.length} conta(s) removida(s).`);
  console.log(`Limpeza: ${sessoesApagadas} sessão(ões) e ${tokensApagados} token(s) apagado(s).`);
  return { avisados, removidos: paraRemover.length, sessoesApagadas, tokensApagados };
}

if (require.main === module) {
  executar().catch((erro) => {
    console.error('Falha no job de inativos:', erro);
    process.exitCode = 1;
  });
}

module.exports = { executar, DIAS_INATIVIDADE, DIAS_AVISO };
