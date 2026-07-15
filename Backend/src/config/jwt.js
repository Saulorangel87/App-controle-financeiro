// Em produção, defina a variável de ambiente JWT_SECRET com um valor
// longo e aleatório (ex: `openssl rand -hex 32`). O valor abaixo é só
// um fallback pra desenvolvimento local — nunca usar em produção.
const EM_PRODUCAO = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET && EM_PRODUCAO) {
  // Em produção, não faz sentido continuar rodando com um segredo
  // previsível — é melhor o servidor nem subir do que subir inseguro.
  console.error(
    'ERRO FATAL: JWT_SECRET não definido em produção. Gere um valor com `openssl rand -hex 32` e defina a variável de ambiente antes de subir o servidor.'
  );
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-troque-em-producao';

if (!process.env.JWT_SECRET) {
  console.warn(
    'AVISO: JWT_SECRET não definido no ambiente. Usando um valor padrão de desenvolvimento — defina JWT_SECRET antes de ir para produção.'
  );
}

module.exports = { JWT_SECRET };
