const db = require('../db');
const { enviarEmailContaRemovida } = require('../services/email');

const DIAS_INATIVIDADE = 90;

// Remove contas sem login há mais de DIAS_INATIVIDADE dias. O cascade do
// banco (ON DELETE CASCADE, ver schema.sql) apaga sozinho todos os dados
// dependentes. O email de aviso é best-effort: se falhar, a remoção segue
// mesmo assim, a inatividade já venceu.
async function executar() {
  const inativos = db.prepare(`
    SELECT id, email FROM usuarios
    WHERE ultimo_login < datetime('now', ?)
  `).all(`-${DIAS_INATIVIDADE} days`);

  for (const usuario of inativos) {
    try {
      await enviarEmailContaRemovida(usuario.email);
    } catch {
      // idem — não expõe/trava a remoção por falha de envio
    }
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(usuario.id);
  }

  console.log(`Remoção de inativos: ${inativos.length} conta(s) removida(s).`);
  return inativos.length;
}

if (require.main === module) {
  executar().catch((erro) => {
    console.error('Falha no job de remoção de inativos:', erro);
    process.exitCode = 1;
  });
}

module.exports = { executar, DIAS_INATIVIDADE };
