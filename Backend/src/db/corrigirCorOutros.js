// Corrige a cor da categoria "Outros" pra quem já tinha essa categoria criada
// com o tom antigo (#6b7280), que falhava no teste de contraste do Lighthouse.
// Só atualiza quem ainda está com a cor antiga — não mexe em quem já
// personalizou a cor manualmente (se essa opção existir no futuro).
//
// Uso (dentro da pasta Backend):
//   node src/db/corrigirCorOutros.js
const db = require('./index');

const COR_ANTIGA = '#6b7280';
const COR_NOVA = '#868c94';

const info = db.prepare(`
  UPDATE categorias SET cor = ? WHERE nome = 'Outros' AND cor = ?
`).run(COR_NOVA, COR_ANTIGA);

if (info.changes === 0) {
  console.log('Nenhuma categoria "Outros" com a cor antiga encontrada — nada a fazer.');
} else {
  console.log(`Cor corrigida em ${info.changes} categoria(s) "Outros".`);
}
