# 💰 Controle de Despesas

Aplicação full-stack de gerenciamento de finanças pessoais, com autenticação multiusuário, categorização de gastos, orçamento mensal editável, alertas de limite e relatórios comparativos entre meses.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/license-MIT-green)](#licença)

🔗 **[Acesse o app em produção](https://despesas.devsaulo.com.br)**

  <img width="1917" height="852" alt="image" src="https://github.com/user-attachments/assets/afed5417-0258-4e48-a40b-66185fab5f83" />
  <img width="1917" height="865" alt="image" src="https://github.com/user-attachments/assets/68ba646d-40b9-48c0-b60c-798cbd809307" />


## 📋 Sobre o projeto

O **Controle de Despesas** nasceu a partir da análise de um design no Figma e evoluiu para uma aplicação completa, construída do zero: modelagem de banco de dados, API REST autenticada, frontend React consumindo a API, e deploy real em infraestrutura self-hosted (Docker + Oracle Cloud + Cloudflare Tunnel).

Cada usuário tem seus próprios dados isolados (despesas, categorias e orçamento), protegidos por autenticação JWT.

## ✨ Funcionalidades

- 🔐 **Cadastro e login** com senha criptografada (bcrypt), sessão via JWT, verificação de email obrigatória e recuperação de senha por email
- 📊 **Dashboard** com total gasto, orçamento, disponível e gráfico de gastos por categoria (pizza no mobile, barra no desktop)
- 🏷️ **Categorias** com limite individual editável e indicador visual de status (OK / Excedido)
- 💸 **CRUD completo de despesas** — criar, editar e excluir, com paginação e bloqueio de data futura
- 🚨 **Alertas automáticos** para categorias que ultrapassaram o limite
- 📅 **Relatório mensal** com comparação de gastos entre o mês atual e o anterior, paginação, e opção de **imprimir**
- 💰 **Orçamento total editável**, definido manualmente pelo usuário
- 🔄 **Dashboard sempre atualizado** ao mês corrente, mesmo com a aba aberta na virada do mês
- 📱 **Totalmente responsivo**, com menu hambúrguer e gráficos adaptados para telas menores

## 🛠️ Tecnologias utilizadas

**Frontend**
- React 19 + Vite (com code-splitting por rota)
- React Router
- Recharts (gráficos)
- Lucide React (ícones)
- Axios

**Backend**
- Node.js + Express
- SQLite (better-sqlite3, modo WAL, índices otimizados)
- JWT (jsonwebtoken) para autenticação
- bcryptjs para hash de senha
- express-rate-limit para proteção contra força bruta
- Resend para envio de email transacional (verificação de conta e recuperação de senha)

**Infraestrutura**
- Docker + Docker Compose (build multi-estágio, Nginx servindo o frontend com cache de assets)
- Deploy self-hosted em Oracle Cloud
- Cloudflare Tunnel (HTTPS automático, sem exposição direta de portas)

## 🔒 Segurança

Alguns cuidados aplicados antes de colocar o app em produção:

- Senhas nunca armazenadas em texto puro (hash com `bcrypt`)
- `JWT_SECRET` obrigatório em produção — o servidor recusa iniciar sem um valor definido
- Cadastro exige confirmação de email antes de liberar o login (evita contas com email inexistente)
- Recuperação de senha com token de uso único e validade curta
- Rate limiting no login/cadastro e nos envios de email (proteção contra força bruta e spam)
- CORS restrito por domínio, não aberto para qualquer origem
- Todas as queries SQL parametrizadas (proteção contra SQL Injection)
- Isolamento de dados por usuário em todas as rotas autenticadas
- Validação de data futura em despesas (frontend + backend)
- Segredos e dados sensíveis nunca versionados (`.gitignore` cobrindo `.env` e banco de dados local)

## ♿ Qualidade e acessibilidade

Auditado com Lighthouse e ajustado continuamente:
- **Performance**: code-splitting por rota, cache de assets estáticos, fontes não-bloqueantes
- **Acessibilidade**: labels de formulário associados corretamente, contraste de cores validado (WCAG AA), links não dependem só de cor, estrutura semântica (`<main>`, `<h1>`)
- **SEO**: meta description, `robots.txt` e `llms.txt` válidos

## 🚀 Como rodar localmente

### Pré-requisitos
- Node.js 20+
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

### Via Docker

```bash
cp .env.example .env
# preencha JWT_SECRET, FRONTEND_URL, VITE_API_URL, RESEND_API_KEY e EMAIL_REMETENTE no .env

docker compose up -d --build
```

## 🗺️ Roadmap

- [x] CRUD de despesas e categorias
- [x] Autenticação multiusuário
- [x] Relatório mensal comparativo, com paginação e impressão
- [x] Deploy em produção
- [x] Melhorias de performance, acessibilidade e SEO (Lighthouse)
- [x] Recuperação de senha e validação de email no cadastro
- [ ] Registro independente de VA/VR (vale alimentação/refeição), sem misturar com o orçamento e gastos atuais
- [ ] Versão mobile (app nativo/PWA)
- [ ] Migração para PostgreSQL (caso o uso simultâneo cresça)

## 👤 Autor

**Saulo Rangel**

- LinkedIn: [linkedin.com/in/saulorangel87](https://www.linkedin.com/in/saulorangel87)
- GitHub: [github.com/Saulorangel87](https://github.com/Saulorangel87)
- Email: sauloleonardo1987@gmail.com

## Licença

Este projeto está sob a licença MIT — veja o arquivo [LICENSE](LICENSE) para mais detalhes.
