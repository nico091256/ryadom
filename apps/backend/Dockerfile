FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

RUN corepack enable && pnpm install --no-frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/backend ./apps/backend

RUN pnpm --filter @localshop/shared build && \
    pnpm --filter @localshop/backend prisma:generate && \
    pnpm --filter @localshop/backend build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/package.json ./package.json

WORKDIR /app/apps/backend
RUN mkdir -p uploads
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
