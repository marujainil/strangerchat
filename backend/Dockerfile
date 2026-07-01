# ============================================================
# StrangerChat Backend — Production Dockerfile (multi-stage)
# ============================================================
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

# ---- deps ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 4000
# Sync the database schema, then boot.
# - If committed migrations exist (prisma/migrations), apply them with the
#   prod-safe `migrate deploy`.
# - Otherwise (fresh repo with no migration history) fall back to `db push`,
#   which syncs the schema directly. Switch to migrations for production change
#   management (see README).
CMD ["sh", "-c", "if [ -d prisma/migrations ] && [ -n \"$(ls -A prisma/migrations 2>/dev/null)\" ]; then npx prisma migrate deploy; else npx prisma db push --accept-data-loss --skip-generate; fi && node dist/server.js"]
