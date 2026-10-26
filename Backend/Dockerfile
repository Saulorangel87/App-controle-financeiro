# Usamos a variante "slim" (baseada em Debian, glibc) em vez de "alpine"
# porque o better-sqlite3 usa um binário nativo pré-compilado que nem
# sempre tem versão pronta pra musl (a libc do alpine) — slim evita esse
# problema sem precisar instalar ferramentas de compilação.
FROM node:24-slim

WORKDIR /app

# Copia só os arquivos de dependência primeiro — assim o Docker reaproveita
# essa camada em rebuilds futuros se o código mudar mas as deps não.
# npm ci instala exatamente o que está no package-lock.json (e falha se ele
# estiver dessincronizado), em vez de resolver versões novas a cada build.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY docker-entrypoint.sh /usr/local/bin/entrypoint-despesas.sh
RUN chmod +x /usr/local/bin/entrypoint-despesas.sh

ENV NODE_ENV=production
EXPOSE 3001

# O entrypoint acerta o dono de /app/data e troca para o usuário "node" antes
# de iniciar o servidor (ver docker-entrypoint.sh).
ENTRYPOINT ["entrypoint-despesas.sh"]
CMD ["node", "src/server.js"]
