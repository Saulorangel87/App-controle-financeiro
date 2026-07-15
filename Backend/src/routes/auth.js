const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const CATEGORIAS_PADRAO = require('../db/categoriasPadrao');
const { JWT_SECRET } = require('../config/jwt');

const router = express.Router();

function gerarToken(usuario) {
  return jwt.sign(
    { usuarioId: usuario.id },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function usuarioPublico(usuario) {
  return { id: usuario.id, nome: usuario.nome, email: usuario.email };
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
    INSERT INTO usuarios (nome, email, senha_hash)
    VALUES (?, ?, ?)
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

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
  const token = gerarToken(usuario);

  res.status(201).json({ token, usuario: usuarioPublico(usuario) });
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

  const token = gerarToken(usuario);
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

module.exports = router;
