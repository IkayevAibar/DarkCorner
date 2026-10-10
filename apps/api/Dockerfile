# Build context: the repository root (the workspace packages live in packages/).
# docker compose builds this with `context: .` — see docker-compose.yml.

FROM node:22-bookworm-slim AS base
WORKDIR /app
# Prisma's engines need OpenSSL; slim images do not ship it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
COPY packages/solo/package.json packages/solo/
# The API's postinstall runs `prisma generate`, which needs the schema.
COPY apps/api/prisma apps/api/prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
RUN npm run build -w @dark/api

FROM base AS runtime
ENV NODE_ENV=production
# node_modules keeps the Prisma CLI, which `migrate deploy` needs at start.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma
WORKDIR /app/apps/api
EXPOSE 4100
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
