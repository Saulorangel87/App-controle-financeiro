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
const relatorioRouter = require('./routes/relatorio');

const app = express();
const PORT = process.env.PORT || 3001;

// Em produção, só aceita chamadas vindas do domínio do próprio frontend.
// Defina FRONTEND_URL (ex: https://despesas.devsaulo.com.br) na Oracle Cloud.
// Em dev, sem essa variável, libera o Vite local.
const origensPermitidas = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
  : ['http://localhost:5173'];

app.use(cors({ origin: origensPermitidas }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Rotas públicas (cadastro/login não exigem token), com limite de tentativas
app.use('/api/auth', limiteAuth, authRouter);

// A partir daqui, toda rota exige um token JWT válido
app.use('/api/categorias', autenticar, categoriasRouter);
app.use('/api/despesas', autenticar, despesasRouter);
app.use('/api/resumo', autenticar, resumoRouter);
app.use('/api/orcamento', autenticar, orcamentoRouter);
app.use('/api/relatorio', autenticar, relatorioRouter);

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
