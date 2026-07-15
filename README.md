# 💰 Controle de Despesas

Aplicação full-stack de gerenciamento de finanças pessoais, com autenticação multiusuário, categorização de gastos, orçamento mensal editável, alertas de limite e relatórios comparativos entre meses.

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite&logoColor=white)](https://sqlite.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License](https://img.shields.io/badge/license-MIT-green)](#licença)

🔗 **[Acesse o app em produção](https://despesas.devsaulo.com.br)**

<!-- 
  Sugestão: adicione aqui um screenshot ou GIF do app em uso.
  Exemplo: ![Dashboard do app](./docs/screenshot-dashboard.png)
-->

---

## 📋 Sobre o projeto

O **Controle de Despesas** nasceu a partir da análise de um design no Figma e evoluiu para uma aplicação completa, construída do zero: modelagem de banco de dados, API REST autenticada, frontend React consumindo a API, e deploy real em infraestrutura self-hosted (Docker + Oracle Cloud + Cloudflare Tunnel).

Cada usuário tem seus próprios dados isolados (despesas, categorias e orçamento), protegidos por autenticação JWT.

## ✨ Funcionalidades

- 🔐 **Cadastro e login** com senha criptografada (bcrypt) e sessão via JWT
- 📊 **Dashboard** com total gasto, orçamento, disponível e gráfico de gastos por categoria
- 🏷️ **Categorias** com limite individual editável e indicador visual de status (OK / Excedido)
- 💸 **CRUD completo de despesas** — criar, editar e excluir
- 🚨 **Alertas automáticos** para categorias que ultrapassaram o limite
- 📅 **Relatório mensal** com comparação de gastos entre o mês atual e o anterior
- 💰 **Orçamento total editável**, definido manualmente pelo usuário
- 📱 **Totalmente responsivo**, com menu hambúrguer em telas menores

## 🛠️ Tecnologias utilizadas

**Frontend**
- React 19 + Vite
- React Router
- Recharts (gráficos)
- Lucide React (ícones)
- Axios

**Backend**
- Node.js + Express
- SQLite (better-sqlite3, modo WAL)
- JWT (jsonwebtoken) para autenticação
- bcryptjs para hash de senha
- express-rate-limit para proteção contra força bruta

**Infraestrutura**
- Docker + Docker Compose (build multi-estágio, Nginx servindo o frontend)
- Deploy self-hosted em Oracle Cloud
- Cloudflare Tunnel (HTTPS automático, sem exposição direta de portas)

## 🔒 Segurança

Alguns cuidados aplicados antes de colocar o app em produção:

- Senhas nunca armazenadas em texto puro (hash com `bcrypt`)
- `JWT_SECRET` obrigatório em produção — o servidor recusa iniciar sem um valor definido
- Rate limiting no login/cadastro (proteção contra força bruta)
- CORS restrito por domínio, não aberto para qualquer origem
- Todas as queries SQL parametrizadas (proteção contra SQL Injection)
- Isolamento de dados por usuário em todas as rotas autenticadas
- Segredos e dados sensíveis nunca versionados (`.gitignore` cobrindo `.env` e banco de dados local)

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

### Via Docker

```bash
cp .env.example .env
# preencha JWT_SECRET, FRONTEND_URL e VITE_API_URL no .env

docker compose up -d --build
```

## 🗺️ Roadmap

- [x] CRUD de despesas e categorias
- [x] Autenticação multiusuário
- [x] Relatório mensal comparativo
- [x] Deploy em produção
- [ ] Verificação de email no cadastro
- [ ] Versão PWA (instalável no celular)
- [ ] Migração para PostgreSQL (caso o uso simultâneo cresça)

## 👤 Autor

**Saulo Rangel**

- LinkedIn: [linkedin.com/in/saulorangel87](https://www.linkedin.com/in/saulorangel87)
- GitHub: [github.com/Saulorangel87](https://github.com/Saulorangel87)
- Email: sauloleonardo1987@gmail.com

## Licença

Este projeto está sob a licença MIT — veja o arquivo [LICENSE](LICENSE) para mais detalhes.
