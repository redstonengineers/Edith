# ── Compilación: web (modo API) y servidor a JavaScript ──
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:api && npm run build:server

# ── Dependencias de producción (sin devDependencies: ni tsx, ni typescript, ni vite) ──
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Imagen final: solo el servidor compilado, el frontend compilado y las dependencias de ejecución ──
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 TRUST_PROXY=1 DB_PATH=/app/data/academy.db
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
# La base de datos vive en /app/data: montar aquí un volumen persistente (se inicializa con este propietario).
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Obligatorio en producción: DATA_ENCRYPTION_KEY (cifrado de datos personales). Sin ella el servidor no arranca.
CMD ["node", "dist-server/index.js"]
