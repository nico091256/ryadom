FROM node:20-alpine AS base
RUN npm install -g pnpm@12.11.2

FROM base AS dependencies
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile=false

COPY packages/shared ./packages/shared
RUN pnpm --filter @localshop/shared build

COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npx prisma generate
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/shared/dist ./packages/shared/dist
COPY --from=dependencies /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=dependencies /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=dependencies /app/apps/api/dist ./apps/api/dist
COPY --from=dependencies /app/apps/api/package.json ./apps/api/package.json
COPY --from=dependencies /app/apps/api/prisma ./apps/api/prisma

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/main"]
