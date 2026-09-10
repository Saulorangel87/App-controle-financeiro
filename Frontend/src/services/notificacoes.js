import api from './api';

function chavePublicaParaBytes(chave) {
  const padding = '='.repeat((4 - (chave.length % 4)) % 4);
  const base64 = (chave + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0));
}

export function pushDisponivel() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function estadoNotificacoes() {
  if (!pushDisponivel()) return { suportado: false, inscrito: false, habilitado: false };
  const [config, estado] = await Promise.all([api.get('/push/config'), api.get('/push/inscricoes')]);
  return { suportado: true, ...config.data, ...estado.data };
}

export async function ativarNotificacoes() {
  const config = await api.get('/push/config');
  if (!config.data.habilitado || !config.data.chavePublica) throw new Error('push indisponível');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('permissão não concedida');
  const registro = await navigator.serviceWorker.ready;
  let inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chavePublicaParaBytes(config.data.chavePublica),
    });
  }
  await api.post('/push/inscricoes', inscricao.toJSON());
  return inscricao;
}

export async function desativarNotificacoes() {
  const registro = await navigator.serviceWorker.ready;
  const inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) return;
  await api.delete('/push/inscricoes', { data: { endpoint: inscricao.endpoint } });
  await inscricao.unsubscribe();
}
