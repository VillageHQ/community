# This file stays out of the repo root on purpose. DigitalOcean App Platform and Railway switch to
# any Dockerfile they find in the root, which would change what their deploy buttons build.
# Build from the repo root: docker build -f deploy/vps/Dockerfile .

FROM node:24-alpine AS builder
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1 COMMUNITY_STANDALONE_BUILD=true
# Node sizes its heap from physical memory. On a 1 GB server the type check runs out unless it can use swap.
ENV NODE_OPTIONS=--max-old-space-size=2048
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN mkdir -p public && pnpm build

FROM node:24-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["node", "server.js"]
