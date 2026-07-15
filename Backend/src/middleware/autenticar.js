const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

// Lê o token do header "Authorization: Bearer <token>", valida, e injeta
// req.usuarioId. Se não houver token válido, responde 401 e bloqueia a rota.
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'não autenticado' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuarioId = payload.usuarioId;
    next();
  } catch {
    res.status(401).json({ erro: 'token inválido ou expirado' });
  }
}

module.exports = autenticar;
