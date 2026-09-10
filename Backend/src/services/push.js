const webpush = require('web-push');
const db = require('../db');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

function pushConfigurado() {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
}

if (pushConfigurado()) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function validarInscricao(inscricao) {
  return inscricao &&
    typeof inscricao.endpoint === 'string' && inscricao.endpoint.length >= 20 && inscricao.endpoint.length <= 2048 &&
    typeof inscricao.keys?.p256dh === 'string' && inscricao.keys.p256dh.length <= 256 &&
    typeof inscricao.keys?.auth === 'string' && inscricao.keys.auth.length <= 256;
}

function salvarInscricao(usuarioId, inscricao) {
  db.prepare(`
    INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      usuario_id = excluded.usuario_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      atualizado_em = datetime('now')
  `).run(usuarioId, inscricao.endpoint, inscricao.keys.p256dh, inscricao.keys.auth);
}

function removerInscricao(usuarioId, endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE usuario_id = ? AND endpoint = ?').run(usuarioId, endpoint);
}

async function enviarPush(inscricao, payload) {
  if (!pushConfigurado()) return false;
  try {
    await webpush.sendNotification({
      endpoint: inscricao.endpoint,
      keys: { p256dh: inscricao.p256dh, auth: inscricao.auth },
    }, JSON.stringify(payload), { TTL: 86400 });
    return true;
  } catch (erro) {
    if (erro.statusCode === 404 || erro.statusCode === 410) {
      db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(inscricao.id);
    }
    console.error(`Falha ao enviar push para inscrição ${inscricao.id}:`, erro.statusCode || erro.message);
    return false;
  }
}

module.exports = {
  VAPID_PUBLIC_KEY,
  pushConfigurado,
  validarInscricao,
  salvarInscricao,
  removerInscricao,
  enviarPush,
};
