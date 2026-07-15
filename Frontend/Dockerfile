# Estágio 1: compila o app React (gera arquivos estáticos em /app/dist)
FROM node:20-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# A URL da API precisa estar "embutida" no JavaScript compilado, já que
# é código que roda no navegador do usuário, não no servidor. Por isso
# vem como build arg (definido no momento do build, não em runtime).
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Estágio 2: imagem final, só com o Nginx servindo os arquivos estáticos
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
