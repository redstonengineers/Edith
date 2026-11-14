FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:api

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 TRUST_PROXY=1 DB_PATH=/app/data/academy.db
COPY package.json package-lock.json ./
# NODE_ENV=production omitiría las devDependencies, y tsx (que ejecuta el servidor) es una de ellas.
RUN npm ci --include=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src ./src
COPY server ./server
COPY tsconfig.json tsconfig.server.json ./
# La base de datos vive en /app/data: montar aquí un volumen persistente (se inicializa con este propietario).
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "server/index.ts"]
