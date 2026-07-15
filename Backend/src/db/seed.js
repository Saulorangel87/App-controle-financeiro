// Seed de desenvolvimento: cria um usuário mock (id=1) e as categorias
// padrão, útil pra testar sem precisar passar pelo cadastro/login toda hora.
// Usuários reais criados pelo /api/auth/registrar recebem essas mesmas
// categorias automaticamente (ver src/routes/auth.js).
const db = require('./index');
const CATEGORIAS_PADRAO = require('./categoriasPadrao');

db.prepare(`
  INSERT OR IGNORE INTO usuarios (id, nome, email, senha_hash)
  VALUES (1, 'Usuário Dev', 'dev@local', 'mock')
`).run();

const insertCategoria = db.prepare(`
  INSERT INTO categorias (usuario_id, nome, icone, cor, limite)
  SELECT 1, ?, ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1 FROM categorias WHERE usuario_id = 1 AND nome = ?
  )
`);

for (const cat of CATEGORIAS_PADRAO) {
  insertCategoria.run(cat.nome, cat.icone, cat.cor, cat.limite, cat.nome);
}

db.prepare(`
  INSERT OR IGNORE INTO orcamento (usuario_id, valor)
  VALUES (1, 3600)
`).run();

console.log('Seed concluído: usuário mock (id=1) e categorias criadas.');
