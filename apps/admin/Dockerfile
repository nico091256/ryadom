FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/

RUN corepack enable && pnpm install --no-frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/admin ./apps/admin

RUN pnpm --filter @localshop/shared build && \
    pnpm --filter @localshop/admin build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static

EXPOSE 3000
CMD ["node", "apps/admin/server.js"]
