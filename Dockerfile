FROM node:22.23-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:api

FROM node:22.23-slim
WORKDIR /app
# curl: la comprobación de salud de Coolify se ejecuta dentro del contenedor y la imagen slim no lo trae.
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 TRUST_PROXY=1 DB_PATH=/data/academy.db
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src ./src
COPY server ./server
COPY tsconfig.json tsconfig.server.json ./
RUN mkdir -p /data && chown -R node:node /app
VOLUME /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# El volumen montado por Coolify llega con propietario root: se ajusta al arrancar y se baja de privilegios antes de ejecutar el servidor.
CMD ["sh","-c","chown -R node:node /data && exec setpriv --reuid=node --regid=node --init-groups env HOME=/home/node node_modules/.bin/tsx server/index.ts"]
