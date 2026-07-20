const rateLimit = require('express-rate-limit');

// Endpoints como "esqueci minha senha" e "reenviar verificação" respondem
// sucesso genérico de propósito (não revelam se o email existe ou não), então
// o limiteAuth normal (que pula requisições bem-sucedidas) não protegeria
// nada aqui — toda chamada "conta como sucesso". Esse limite conta tudo,
// sem exceção: no máximo 3 pedidos de email por IP a cada 15 minutos.
const limiteEmail = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitos pedidos de email em pouco tempo. Aguarde 15 minutos e tente novamente.' },
});

module.exports = limiteEmail;
