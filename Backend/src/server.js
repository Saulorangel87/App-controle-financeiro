// Carrega o .env pra dentro de process.env — só tem efeito rodando fora do
// Docker (`npm run dev`). No Docker, as variáveis já chegam prontas via
// docker-compose, e o dotenv nunca sobrescreve uma variável que já existe,
// então é seguro deixar essa chamada aqui incondicionalmente.
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const autenticar = require('./middleware/autenticar');
const limiteAuth = require('./middleware/limiteAuth');
const authRouter = require('./routes/auth');
const categoriasRouter = require('./routes/categorias');
const despesasRouter = require('./routes/despesas');
const resumoRouter = require('./routes/resumo');
const orcamentoRouter = require('./routes/orcamento');
const entradasRouter = require('./routes/entradas');
const recorrentesRouter = require('./routes/recorrentes');
const relatorioRouter = require('./routes/relatorio');
const metasRouter = require('./routes/metas');
const importacaoRouter = require('./routes/importacao');
const pushRouter = require('./routes/push');

const app = express();
const PORT = process.env.PORT || 3001;

// O app roda atrás do Cloudflare Tunnel, então o IP real do usuário vem no
// X-Forwarded-For. Sem isso o rate limit enxerga todos os usuários como o
// mesmo IP (o do túnel) e um só atacante bloquearia o login de todo mundo.
// "1" = confiar apenas no último salto (o IP que o Cloudflare acrescenta),
// o que impede o cliente de forjar o cabeçalho. Nunca usar `true` aqui.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS ?? 1));

// Headers básicos de segurança. O HSTS é aplicado somente em produção,
// quando o acesso público acontece exclusivamente por HTTPS.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Em produção, só aceita chamadas vindas do domínio do próprio frontend.
// Defina FRONTEND_URL (ex: https://despesas.devsaulo.com.br) na Oracle Cloud.
// Em dev, sem essa variável, libera o Vite local.
const origensPermitidas = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
  : ['http://localhost:5173'];

app.use(cors({ origin: origensPermitidas, credentials: true }));

// Limite padrão de 32kb é suficiente pra qualquer rota comum do app. A
// importação de extrato é a única exceção: um lote de até 500 lançamentos
// em JSON passa fácil desse teto, então só ela usa um limite maior.
const corpoJsonPadrao = express.json({ limit: '32kb' });
const corpoJsonImportacao = express.json({ limit: '512kb' });
app.use((req, res, next) => {
  if (req.path.startsWith('/api/importacao')) return corpoJsonImportacao(req, res, next);
  return corpoJsonPadrao(req, res, next);
});

app.get('/api/health', (req, res) => {
  try {
    const banco = require('./db');
    banco.prepare('SELECT 1 AS ok').get();
    res.json({ status: 'ok', banco: 'ok' });
  } catch {
    res.status(503).json({ status: 'degradado', banco: 'indisponível' });
  }
});

// Rotas públicas (cadastro/login não exigem token), com limite de tentativas
app.use('/api/auth', limiteAuth, authRouter);

// A partir daqui, toda rota exige um token JWT válido
app.use('/api/categorias', autenticar, categoriasRouter);
app.use('/api/despesas', autenticar, despesasRouter);
app.use('/api/resumo', autenticar, resumoRouter);
app.use('/api/orcamento', autenticar, orcamentoRouter);
app.use('/api/entradas', autenticar, entradasRouter);
app.use('/api/recorrentes', autenticar, recorrentesRouter);
app.use('/api/relatorio', autenticar, relatorioRouter);
app.use('/api/metas', autenticar, metasRouter);
app.use('/api/importacao', autenticar, importacaoRouter);
app.use('/api/push', autenticar, pushRouter);

// Exportar o app permite testes HTTP sem abrir uma porta fixa.
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}
