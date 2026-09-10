// Service worker mínimo, com dois objetivos:
// 1) Satisfazer o critério de "instalável" do Chrome (ele quer um service worker
//    ativo com um manipulador de fetch, além do manifest.json).
// 2) De brinde, cachear o "shell" do app (HTML/CSS/JS principais), então uma
//    segunda visita carrega mais rápido e o app abre mesmo com internet instável.
//
// Não cacheia chamadas à API (esse cache é só para os arquivos estáticos do
// próprio frontend) — dados de despesas sempre vêm da rede, nunca do cache.

const NOME_CACHE = "despesas-shell-v7";

self.addEventListener("push", (evento) => {
  let dados = {};
  try { dados = evento.data ? evento.data.json() : {}; } catch { /* payload inválido não gera aviso */ }
  evento.waitUntil(self.registration.showNotification(dados.titulo || "Controle de Despesas", {
    body: dados.corpo || "Você tem uma despesa recorrente próxima do vencimento.",
    // O ícone colorido aparece ao lado do conteúdo da notificação.
    icon: "/notification-icon-192.png?v=1",
    // O badge é o símbolo pequeno da barra do Android e precisa ser
    // monocromático, com fundo transparente, para o sistema aplicar a cor.
    badge: "/notification-badge-96.png?v=2",
    tag: dados.tipo || "controle-despesas",
    data: { url: dados.url || "/recorrentes" },
  }));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || "/recorrentes", self.location.origin).href;
  evento.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
    const janela = janelas.find((item) => item.url.startsWith(self.location.origin));
    if (janela) { janela.focus(); return janela.navigate(destino); }
    return clients.openWindow(destino);
  }));
});

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(NOME_CACHE).then((cache) => cache.add("/"))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  // Remove caches de versões antigas (se um dia trocarmos NOME_CACHE para
  // invalidar o cache depois de uma mudança grande no app).
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(
        chaves
          .filter((chave) => chave !== NOME_CACHE)
          .map((chave) => caches.delete(chave))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  // Só intercepta requisições GET para o próprio domínio (arquivos estáticos).
  // Chamadas à API (outro domínio) e métodos como POST/PUT passam direto pela rede.
  if (evento.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Estratégia "network-first, cache como fallback": tenta buscar na rede
  // primeiro (garante conteúdo sempre atualizado), e só usa o cache se a
  // rede falhar (offline ou instável).
  evento.respondWith(
    fetch(evento.request)
      .then((resposta) => {
        const respostaClone = resposta.clone();
        caches.open(NOME_CACHE).then((cache) => cache.put(evento.request, respostaClone));
        return resposta;
      })
      .catch(() => caches.match(evento.request))
  );
});
