FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/store/package.json ./apps/store/

RUN corepack enable && pnpm install --no-frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/store ./apps/store

RUN pnpm --filter @localshop/shared build && \
    pnpm --filter @localshop/store build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/apps/store/.next/standalone ./
COPY --from=builder /app/apps/store/.next/static ./apps/store/.next/static

EXPOSE 3001
CMD ["node", "apps/store/server.js"]
