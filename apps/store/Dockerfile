FROM node:20-alpine AS base
RUN npm install -g pnpm@12.11.2

FROM base AS dependencies
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/store/package.json ./apps/store/

RUN pnpm install --frozen-lockfile=false

COPY packages/shared ./packages/shared
RUN pnpm --filter @localshop/shared build

COPY apps/store ./apps/store
WORKDIR /app/apps/store
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/shared/dist ./packages/shared/dist
COPY --from=dependencies /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=dependencies /app/apps/store/node_modules ./apps/store/node_modules
COPY --from=dependencies /app/apps/store/.next ./apps/store/.next
COPY --from=dependencies /app/apps/store/package.json ./apps/store/package.json
COPY --from=dependencies /app/apps/store/public ./apps/store/public

EXPOSE 3001
WORKDIR /app/apps/store
CMD ["node_modules/.bin/next", "start", "-p", "3001"]
