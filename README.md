# 💰 Controle de Despesas

Aplicação full-stack de gerenciamento de finanças pessoais, com autenticação multiusuário, categorização de gastos, orçamento mensal editável, alertas de limite e relatórios comparativos entre meses.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/license-MIT-green)](#licença)

🔗 **[Acesse o app em produção](https://despesas.devsaulo.com.br)** — instalável como app no celular/desktop (veja a seção PWA abaixo)

  <img width="1917" height="852" alt="image" src="https://github.com/user-attachments/assets/afed5417-0258-4e48-a40b-66185fab5f83" />
  <img width="1917" height="865" alt="image" src="https://github.com/user-attachments/assets/68ba646d-40b9-48c0-b60c-798cbd809307" />

## 📋 Sobre o projeto

O **Controle de Despesas** nasceu a partir da análise de um design no Figma e evoluiu para uma aplicação completa, construída do zero: modelagem de banco de dados, API REST autenticada, frontend React consumindo a API, e deploy real em infraestrutura self-hosted (Docker + Oracle Cloud + Cloudflare Tunnel).

Cada usuário tem seus próprios dados isolados (despesas, categorias e orçamento), protegidos por autenticação JWT.

## 📲 Instalável como app (PWA)

O site pode ser instalado no celular ou no computador como um aplicativo de
verdade, sem barra de endereço — não é só um atalho de navegador.

- **Android/Chrome:** abra o menu (⋮) e toque em **"Instalar app"**, ou use o
  ícone de instalação (⊕) na barra de endereço no desktop.
- **iOS/Safari:** toque em compartilhar → **"Adicionar à Tela de Início"**.

Isso é possível graças a `manifest.json`, ícones em duas resoluções e um
service worker mínimo (`Frontend/public/sw.js`), que também cacheia o "shell"
do app para abrir mais rápido numa segunda visita — sem nunca cachear dados
financeiros, que sempre vêm direto da API.

Na tela **Alertas**, o usuário também pode ativar notificações push neste
celular. Os avisos de despesas recorrentes são enviados 3 e 1 dia antes do
vencimento, inclusive quando o vencimento cai no início do mês seguinte, e
cada conta gera sua própria notificação (duas contas no mesmo dia não se
sobrescrevem). No iPhone, é necessário instalar o PWA na Tela de Início antes de
autorizar as notificações.

## ✨ Funcionalidades

- 🔐 **Cadastro e login** com senha criptografada (bcrypt, mínimo de 8 caracteres), access token JWT curto com refresh token seguro, verificação de email obrigatória, recuperação de senha por email, **troca de senha logado** e opção de **sair de todos os dispositivos**
- 📊 **Dashboard** com total gasto, orçamento, disponível, **projeção de fechamento do mês** (gastos do dia a dia no ritmo atual + contas fixas pagas contadas uma vez só), **fatura aberta do cartão de crédito** (com dia de fechamento configurável) e gráfico de gastos por categoria (pizza no mobile, barra no desktop)
- 🏷️ **Gerenciamento completo de categorias** — criar, renomear, escolher ícone e cor, editar limite mensal e excluir categorias sem lançamentos, com indicador visual de status (OK / Excedido)
- 💸 **CRUD completo de despesas** — criar, editar e excluir (sem pop-up de confirmação: a exclusão mostra **Desfazer** na hora), **tela de histórico** em `/historico` com tudo o que foi criado, editado e excluído e opção de restaurar exclusões, busca por descrição, filtros por mês/categoria/forma de pagamento, paginação e bloqueio de data futura (exceto ao lançar num mês à frente escolhido no seletor)
- 🚨 **Alertas automáticos** para categorias que ultrapassaram o limite
- 📅 **Relatório mensal** com filtro por período/categoria, comparação de gastos, entradas, saldo, paginação e opção de **imprimir**
- 📤 **Exportação Excel** do relatório mensal, com resumo financeiro, totais, despesas, entradas e formatação profissional
- 💰 **Orçamento total editável por mês** — cada mês começa com o seu próprio orçamento (nada se repete sozinho) e o botão **Copiar mês anterior** traz o valor-base do mês anterior com um clique (entradas avulsas como bônus ficam só no mês delas)
- 📆 **Seletor de mês** no topo de todas as telas: escolha outro mês (até 12 meses à frente ou qualquer mês passado) e tudo passa a mostrar esse mês, como se ele tivesse virado — Visão Geral, orçamento, categorias, alertas, recorrentes (pago/parcela de cada mês) e os formulários de lançamento. Dá, por exemplo, para lançar as contas de novembro no dia 31 de outubro. O app sempre abre no mês atual, e o orçamento de um mês novo começa zerado
- 🔄 **Dashboard sempre atualizado** ao mês corrente, mesmo com a aba aberta na virada do mês
- 📱 **Totalmente responsivo e instalável (PWA)**, com menu hambúrguer e gráficos adaptados para telas menores
- ⬇️ **Instalação pelo rodapé** quando o navegador oferecer a instalação e o app ainda não estiver instalado
- 🔔 **Notificações push opcionais** para despesas recorrentes próximas do vencimento
- 🔁 **Despesas recorrentes integradas aos gastos do mês** — ao marcar uma conta fixa ou prestação como paga, o app abre a confirmação para já lançá-la como despesa do mês (lembrando categoria e forma de pagamento para o próximo mês), e desmarcar desfaz o lançamento
- 🆕 **Notas da versão** em `/novidades`, com as novidades da v2.1.0 (seletor de mês) e o resumo das entregas de arquitetura e segurança
- 💵 **CRUD completo de entradas em aba própria**, com criação, edição, exclusão, filtro mensal, total do período e ajuste automático do orçamento do mês
- 📥 **Importação de extrato bancário (.csv e .ofx)** com pré-visualização, classificação automática entre despesas e entradas e detecção automática de lançamentos duplicados (já importados ou repetidos no próprio arquivo)
- 🌗 **Tema claro e escuro**, com detecção automática da preferência do sistema e alternância manual salva por dispositivo, com transição suave de cores
- 🧠 **Categoria sugerida automaticamente** ao repetir uma descrição já usada antes, com base no próprio histórico do usuário
- 📈 **Comparativo ano a ano e gráfico de tendência** dos últimos 6 meses no Relatório
- 🐷 **Metas de economia por período**, com progresso calculado automaticamente pelo saldo (entradas − despesas)
- 🤝 **Divisão de despesa com outra pessoa** (sem precisar que ela tenha conta), mostrando "sua parte" separada do valor total
- 📥 **Importação de extrato bancário em CSV**, com revisão dos lançamentos antes de confirmar e categoria já sugerida
- 🗑️ **Exclusão da própria conta** (tela `/conta`, acessível pelo nome do usuário ou pelo menu "Minha conta" no celular) e aviso por email antes da remoção automática de contas inativas

## 🛠️ Tecnologias utilizadas

O projeto possui CI no GitHub Actions: cada push ou pull request para `main`
executa os testes do backend, o lint do frontend e o build de produção. O
deploy de produção segue o mesmo padrão manual do CDD Campos: **Run workflow**,
build-check, Tailscale e publicação na VPS. Veja o [runbook de deploy](docs/DEPLOY-GITHUB.md)
para a configuração da infraestrutura.

**Frontend**
- React 19 + Vite (com code-splitting por rota)
- React Router
- Recharts (gráficos)
- Lucide React (ícones)
- Axios

**Backend**
- Node.js + Express 5 (erros em rotas assíncronas chegam ao tratamento central, nunca derrubam o processo)
- SQLite (better-sqlite3, modo WAL, índices otimizados)
- JWT (jsonwebtoken) para autenticação
- bcryptjs para hash de senha
- express-rate-limit para proteção contra força bruta
- web-push para entrega criptografada de notificações ao dispositivo autorizado
- Resend para envio de email transacional (verificação de conta e recuperação de senha)

**Infraestrutura**
- Docker + Docker Compose (build multi-estágio, Nginx servindo o frontend com cache de assets)
- Backend roda como usuário sem privilégios (`node`), com `init`, `no-new-privileges` e healthcheck nos dois containers
- Deploy self-hosted em Oracle Cloud
- Cloudflare Tunnel (HTTPS automático, sem exposição direta de portas)

## 🔒 Segurança

Alguns cuidados aplicados antes de colocar o app em produção:

- Senhas nunca armazenadas em texto puro (hash com `bcrypt`)
- `JWT_SECRET` obrigatório em produção — o servidor recusa iniciar sem um valor definido
- Cadastro exige confirmação de email antes de liberar o login (evita contas com email inexistente)
- Recuperação de senha com token de uso único e validade curta
- Refresh token rotativo em cookie `HttpOnly`: a cada renovação o token anterior é revogado (com 30 s de tolerância para abas/requisições que renovam ao mesmo tempo), e o logout invalida a sessão inteira
- Rate limiting no login/cadastro e nos envios de email (proteção contra força bruta e spam) — por IP real do cliente (`trust proxy` de 1 salto atrás do Cloudflare Tunnel, sem aceitar `X-Forwarded-For` forjado)
- CORS restrito por domínio, não aberto para qualquer origem
- Content-Security-Policy no Nginx: scripts só do próprio domínio (o script inline do tema é liberado pelo hash, calculado no build da imagem), conexões só com a API e `frame-ancestors 'none'`; cabeçalhos de segurança em todas as respostas, inclusive no `index.html`
- Todas as queries SQL parametrizadas (proteção contra SQL Injection)
- Validação de tipo e tamanho em todos os campos recebidos pela API e tratamento central de erros: um payload malformado recebe `400` em JSON, nunca derruba o servidor
- Isolamento de dados por usuário em todas as rotas autenticadas
- Validação de data futura em despesas e entradas (frontend + backend), sempre no horário de Brasília (`APP_TIMEZONE`) — o servidor roda em UTC, mas "hoje" e "mês atual" nunca viram às 21h. Com um mês futuro escolhido no seletor, o formulário aceita datas até o fim daquele mês; o backend aceita até o fim do 12º mês à frente

### Backup do banco

O backend cria backups consistentes com `npm run backup`. Em produção, defina
`BACKUP_ENCRYPTION_KEY` com 64 caracteres hexadecimais e `BACKUP_RETENTION_DAYS`
para manter somente a janela necessária. Depois, valide o backup mais recente
com `npm run backup:verify`. O script `ops/backup-despesas.sh` executa o
backup e verifica sua integridade; recomenda-se agendá-lo diariamente na infraestrutura e
copiar os arquivos criptografados para um armazenamento separado. O script também envia
automaticamente o último arquivo `.db.enc` para um bucket privado. O procedimento
detalhado de configuração e recuperação fica no runbook operacional local.
- Segredos e dados sensíveis nunca versionados (`.gitignore` cobrindo `.env` e banco de dados local)

## ♿ Qualidade, acessibilidade e SEO

Auditado com Lighthouse/PageSpeed Insights e ajustado continuamente:
- **Performance**: code-splitting por rota, cache de assets estáticos, fontes não-bloqueantes
- **Acessibilidade**: labels de formulário associados corretamente, contraste de cores validado (WCAG AA), links não dependem só de cor, estrutura semântica (`<main>`, `<h1>`)
- **SEO**: meta description, `robots.txt` e `llms.txt` válidos (app público, indexação liberada — está linkado no LinkedIn como peça de portfólio)
- **PWA**: manifest.json, ícones e service worker — instalação confiável como app completo

## 🚀 Como rodar localmente

### Pré-requisitos
- Node.js 24+ (LTS)
- Docker e Docker Compose (opcional, para rodar via container)

### Modo desenvolvimento

```bash
# Backend
cd Backend
npm install
npm run seed   # cria o banco com dados iniciais
npm run dev    # roda em http://localhost:3001

# Frontend (em outro terminal)
cd Frontend
npm install
npm run dev    # roda em http://localhost:5173
```

> Sem uma `RESEND_API_KEY` configurada, o backend não trava — ele só imprime o link de verificação/recuperação de senha no console em vez de mandar o email de verdade, o que já é suficiente pra testar o fluxo localmente.

> Service worker (PWA) só funciona em `localhost` ou em produção (HTTPS) — em outro IP da rede local sem HTTPS, o navegador bloqueia o registro por segurança.

### Via Docker

```bash
cp .env.example .env
# preencha JWT_SECRET, FRONTEND_URL, VITE_API_URL, RESEND_API_KEY e EMAIL_REMETENTE no .env

docker compose up -d --build
```

## 🗺️ Roadmap

### v2.0 — confiabilidade profissional (concluída)
- [x] Backup automático criptografado, envio externo e teste de integridade/restauração
- [x] Transações atômicas e validação financeira rigorosa no backend
- [x] Sessão e headers de segurança reforçados (access token curto + refresh token em cookie HttpOnly)
- [x] CI (testes do backend, lint e build do frontend) e testes de integração da API
- [x] Fechamento mensal (receitas, despesas, saldo e categorias excedidas) e filtros por período/categoria/forma de pagamento no Relatório
- [x] Smoke tests do frontend (Vitest + Testing Library) rodando no CI
- [x] Exportação CSV/Excel do relatório (PDF já coberto pelo "Imprimir") e histórico de alterações de despesas/entradas
- [x] Notificações push no celular para despesas recorrentes (3 e 1 dia antes)

- [x] CRUD de despesas e categorias
- [x] Autenticação multiusuário
- [x] Relatório mensal comparativo, com paginação e impressão
- [x] Deploy em produção
- [x] Melhorias de performance, acessibilidade e SEO (Lighthouse)
- [x] Recuperação de senha e validação de email no cadastro
- [x] Versão instalável (PWA)
- [x] Opção de excluir a própria conta
- [x] Exclusão automática de usuários inativos há mais de 90 dias, com aviso por email 7 dias antes (a remoção só ocorre depois do aviso)
- [ ] Migração para PostgreSQL (caso o uso simultâneo cresça)

## 👤 Autor

**Saulo Rangel**

- LinkedIn: [linkedin.com/in/saulorangel87](https://www.linkedin.com/in/saulorangel87)
- GitHub: [github.com/Saulorangel87](https://github.com/Saulorangel87)
- Email: sauloleonardo1987@gmail.com

## Licença

Este projeto está sob a licença MIT — veja o arquivo [LICENSE](LICENSE) para mais detalhes.
