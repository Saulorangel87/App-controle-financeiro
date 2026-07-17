// Script pontual: adiciona à conta de cada usuário JÁ EXISTENTE qualquer
// categoria de CATEGORIAS_PADRAO que ele ainda não tenha (comparando pelo
// nome). Não duplica, não altera nem remove nenhuma categoria existente —
// só preenche o que falta. Idempotente: rodar de novo não faz nada se já
// não houver nada faltando.
//
// Uso (dentro da pasta Backend):
//   node src/db/adicionarCategoriasFaltantes.js
// ou, se preferir rodar de dentro do container Docker:
//   sudo docker compose exec backend node src/db/adicionarCategoriasFaltantes.js
const db = require('./index');
const CATEGORIAS_PADRAO = require('./categoriasPadrao');

const usuarios = db.prepare('SELECT id, nome FROM usuarios').all();

const jaTemCategoria = db.prepare(
  'SELECT 1 FROM categorias WHERE usuario_id = ? AND nome = ?'
);
const inserirCategoria = db.prepare(`
  INSERT INTO categorias (usuario_id, nome, icone, cor, limite)
  VALUES (?, ?, ?, ?, ?)
`);

let totalAdicionadas = 0;

for (const usuario of usuarios) {
  for (const cat of CATEGORIAS_PADRAO) {
    const existe = jaTemCategoria.get(usuario.id, cat.nome);
    if (existe) continue;

    inserirCategoria.run(usuario.id, cat.nome, cat.icone, cat.cor, cat.limite);
    totalAdicionadas += 1;
    console.log(`+ "${cat.nome}" adicionada para ${usuario.nome} (usuario_id=${usuario.id})`);
  }
}

if (totalAdicionadas === 0) {
  console.log('Nenhuma categoria faltando — todos os usuários já têm a lista padrão completa.');
} else {
  console.log(`\nConcluído: ${totalAdicionadas} categoria(s) adicionada(s) no total.`);
}
