FROM node:22.23-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:api

FROM node:22.23-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 TRUST_PROXY=1 DB_PATH=/data/academy.db
COPY package.json package-lock.json ./
RUN npm ci && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src ./src
COPY server ./server
COPY tsconfig.json tsconfig.server.json ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx","tsx","server/index.ts"]
