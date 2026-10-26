# Estágio 1: compila o app React (gera arquivos estáticos em /app/dist)
FROM node:24-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# A URL da API precisa estar "embutida" no JavaScript compilado, já que
# é código que roda no navegador do usuário, não no servidor. Por isso
# vem como build arg (definido no momento do build, não em runtime).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# O Content-Security-Policy depende do build (hash do script inline do
# index.html) e da URL da API, então os cabeçalhos são gerados aqui.
RUN node scripts/gerar-cabecalhos-nginx.mjs nginx/cabecalhos-seguranca.conf dist/index.html /app/cabecalhos-seguranca.conf

# Estágio 2: imagem final, só com o Nginx servindo os arquivos estáticos
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/cabecalhos-seguranca.conf /etc/nginx/cabecalhos-seguranca.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
