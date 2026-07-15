const rateLimit = require('express-rate-limit');

// Limita tentativas ERRADAS de login/cadastro por IP: no máximo 5 falhas
// a cada 5 minutos. Logins e cadastros bem-sucedidos não contam pro limite
// (skipSuccessfulRequests), então usar o app normalmente — entrar, sair,
// entrar de novo — nunca esbarra nesse bloqueio, só tentativas repetidas
// de senha errada.
const limiteAuth = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { erro: 'Muitas tentativas com senha incorreta. Aguarde 5 minutos e tente novamente.' },
});

module.exports = limiteAuth;
