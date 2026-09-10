const express = require('express');
const db = require('../db');
const {
  VAPID_PUBLIC_KEY,
  pushConfigurado,
  validarInscricao,
  salvarInscricao,
  removerInscricao,
} = require('../services/push');

const router = express.Router();

router.get('/config', (_req, res) => {
  res.json({ habilitado: pushConfigurado(), chavePublica: VAPID_PUBLIC_KEY || null });
});

router.get('/inscricoes', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS total FROM push_subscriptions WHERE usuario_id = ?').get(req.usuarioId).total;
  res.json({ inscrito: total > 0 });
});

router.post('/inscricoes', (req, res) => {
  if (!pushConfigurado()) return res.status(503).json({ erro: 'notificações push ainda não configuradas' });
  if (!validarInscricao(req.body)) return res.status(400).json({ erro: 'inscrição de push inválida' });
  salvarInscricao(req.usuarioId, req.body);
  res.status(204).send();
});

router.delete('/inscricoes', (req, res) => {
  if (typeof req.body?.endpoint !== 'string') return res.status(400).json({ erro: 'endpoint é obrigatório' });
  removerInscricao(req.usuarioId, req.body.endpoint);
  res.status(204).send();
});

module.exports = router;
