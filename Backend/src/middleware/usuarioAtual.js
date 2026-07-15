// Middleware de "usuário atual". Por enquanto retorna sempre o usuário mock (id=1),
// criado pelo seed. Quando o login for implementado, essa função passa a ler o
// usuário a partir do token/sessão — e o resto do código (rotas) não muda nada,
// porque todas usam req.usuarioId.
function usuarioAtual(req, res, next) {
  req.usuarioId = 1; // TODO: substituir pelo usuário autenticado quando o login existir
  next();
}

module.exports = usuarioAtual;
