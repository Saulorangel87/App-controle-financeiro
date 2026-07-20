const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const CATEGORIAS_PADRAO = require('../db/categoriasPadrao');
const { JWT_SECRET } = require('../config/jwt');
const limiteEmail = require('../middleware/limiteEmail');
const { enviarEmailVerificacao, enviarEmailRecuperacaoSenha } = require('../services/email');

const router = express.Router();

function gerarTokenSessao(usuario) {
  return jwt.sign(
    { usuarioId: usuario.id },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function usuarioPublico(usuario) {
  return { id: usuario.id, nome: usuario.nome, email: usuario.email };
}

// Gera um token aleatório seguro (verificação de email / recuperação de senha)
// e já grava na tabela "tokens" com o prazo de validade.
function criarTokenTemporario(usuarioId, tipo, horasValidade) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiraEm = new Date(Date.now() + horasValidade * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO tokens (usuario_id, token, tipo, expira_em)
    VALUES (?, ?, ?, ?)
  `).run(usuarioId, token, tipo, expiraEm);
  return token;
}

// Busca um token válido: existe, é do tipo esperado, não foi usado ainda e
// não expirou. Retorna null se qualquer uma dessas condições falhar.
function buscarTokenValido(token, tipo) {
  const registro = db.prepare(`
    SELECT * FROM tokens WHERE token = ? AND tipo = ? AND usado = 0
  `).get(token, tipo);
  if (!registro) return null;
  if (new Date(registro.expira_em) < new Date()) return null;
  return registro;
}

// POST /api/auth/registrar
router.post('/registrar', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'nome, email e senha são obrigatórios' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'a senha precisa ter pelo menos 6 caracteres' });
  }

  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (existente) {
    return res.status(409).json({ erro: 'já existe uma conta com esse email' });
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const info = db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, email_verificado)
    VALUES (?, ?, ?, 0)
  `).run(nome, email.toLowerCase(), senhaHash);

  const usuarioId = info.lastInsertRowid;

  // Cria as categorias padrão e o orçamento inicial pro novo usuário
  const insertCategoria = db.prepare(`
    INSERT INTO categorias (usuario_id, nome, icone, cor, limite)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const cat of CATEGORIAS_PADRAO) {
    insertCategoria.run(usuarioId, cat.nome, cat.icone, cat.cor, cat.limite);
  }
  db.prepare('INSERT INTO orcamento (usuario_id, valor) VALUES (?, 0)').run(usuarioId);

  const tokenVerificacao = criarTokenTemporario(usuarioId, 'verificacao_email', 24);
  try {
    await enviarEmailVerificacao(email.toLowerCase(), tokenVerificacao);
  } catch {
    // Não derruba o cadastro se o envio falhar — a pessoa ainda pode pedir
    // reenvio depois. O erro já fica registrado no log do servidor.
  }

  // Cadastro não faz login automático: a conta só fica utilizável depois
  // de confirmar o email (ver POST /login).
  res.status(201).json({
    mensagem: 'Cadastro realizado. Verifique seu email para ativar a conta.',
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'email e senha são obrigatórios' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (!usuario) {
    return res.status(401).json({ erro: 'email ou senha inválidos' });
  }

  const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaCorreta) {
    return res.status(401).json({ erro: 'email ou senha inválidos' });
  }

  if (!usuario.email_verificado) {
    return res.status(403).json({
      erro: 'confirme seu email antes de entrar',
      emailNaoVerificado: true,
    });
  }

  const token = gerarTokenSessao(usuario);
  res.json({ token, usuario: usuarioPublico(usuario) });
});

// GET /api/auth/me — retorna o usuário do token atual (útil pro front
// verificar se a sessão salva ainda é válida)
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'não autenticado' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(payload.usuarioId);
    if (!usuario) return res.status(401).json({ erro: 'não autenticado' });
    res.json({ usuario: usuarioPublico(usuario) });
  } catch {
    res.status(401).json({ erro: 'token inválido ou expirado' });
  }
});

// POST /api/auth/verificar-email
// Chamado pela página /verificar-email do frontend, que lê o token da URL
// (?token=...) e faz essa chamada via JS — de propósito não é um link GET
// direto pra API, pra não correr risco de scanners de segurança de email
// "clicarem" no link antes da pessoa e queimarem o token à toa.
router.post('/verificar-email', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ erro: 'token é obrigatório' });
  }

  const registro = buscarTokenValido(token, 'verificacao_email');
  if (!registro) {
    return res.status(400).json({ erro: 'link inválido ou expirado' });
  }

  db.prepare('UPDATE usuarios SET email_verificado = 1 WHERE id = ?').run(registro.usuario_id);
  db.prepare('UPDATE tokens SET usado = 1 WHERE id = ?').run(registro.id);

  res.json({ mensagem: 'Email confirmado! Você já pode entrar.' });
});

// POST /api/auth/reenviar-verificacao
// Sempre responde com a mesma mensagem genérica, exista ou não o email —
// evita que alguém use esse endpoint pra descobrir quais emails têm conta.
router.post('/reenviar-verificacao', limiteEmail, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ erro: 'email é obrigatório' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (usuario && !usuario.email_verificado) {
    const token = criarTokenTemporario(usuario.id, 'verificacao_email', 24);
    try {
      await enviarEmailVerificacao(usuario.email, token);
    } catch {
      // Mesma lógica do cadastro: não expõe falha de envio pra quem pediu.
    }
  }

  res.json({ mensagem: 'Se esse email tiver uma conta pendente de confirmação, um novo link foi enviado.' });
});

// POST /api/auth/esqueci-senha
// Mesma lógica de resposta genérica do reenvio de verificação.
router.post('/esqueci-senha', limiteEmail, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ erro: 'email é obrigatório' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (usuario) {
    const token = criarTokenTemporario(usuario.id, 'recuperacao_senha', 1);
    try {
      await enviarEmailRecuperacaoSenha(usuario.email, token);
    } catch {
      // idem — não expõe falha de envio
    }
  }

  res.json({ mensagem: 'Se esse email tiver uma conta, um link de redefinição foi enviado.' });
});

// POST /api/auth/redefinir-senha
router.post('/redefinir-senha', async (req, res) => {
  const { token, novaSenha } = req.body;
  if (!token || !novaSenha) {
    return res.status(400).json({ erro: 'token e novaSenha são obrigatórios' });
  }
  if (novaSenha.length < 6) {
    return res.status(400).json({ erro: 'a senha precisa ter pelo menos 6 caracteres' });
  }

  const registro = buscarTokenValido(token, 'recuperacao_senha');
  if (!registro) {
    return res.status(400).json({ erro: 'link inválido ou expirado' });
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(senhaHash, registro.usuario_id);
  db.prepare('UPDATE tokens SET usado = 1 WHERE id = ?').run(registro.id);

  res.json({ mensagem: 'Senha redefinida! Você já pode entrar com a nova senha.' });
});

module.exports = router;
