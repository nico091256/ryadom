FROM node:20-alpine AS base
RUN npm install -g pnpm@12.11.2

FROM base AS dependencies
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/admin/package.json ./apps/admin/

RUN pnpm install --frozen-lockfile=false

COPY packages/shared ./packages/shared
RUN pnpm --filter @localshop/shared build

COPY apps/admin ./apps/admin
WORKDIR /app/apps/admin
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/shared/dist ./packages/shared/dist
COPY --from=dependencies /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=dependencies /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=dependencies /app/apps/admin/.next ./apps/admin/.next
COPY --from=dependencies /app/apps/admin/package.json ./apps/admin/package.json
COPY --from=dependencies /app/apps/admin/public ./apps/admin/public

EXPOSE 3000
WORKDIR /app/apps/admin
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
