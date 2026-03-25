FROM node:22-alpine AS base

# -- Dependencies ---------------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# -- Builder --------------------------------------------------------------------
FROM base AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Dummy env vars so lib/env.ts validation passes during build.
# Real values are provided at runtime.
ENV SESSION_SECRET=build-placeholder
ENV ADMIN_PASSWORD_HASH=build-placeholder
ENV RIOT_API_KEY=build-placeholder

RUN npm run build

# -- Runner ---------------------------------------------------------------------
FROM base AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Cache directory for Next.js image optimization (writable by any uid via compose user override)
RUN mkdir -p /app/.next/cache && chmod 777 /app/.next/cache

# Directory for SQLite database (mount as volume)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data
VOLUME /app/data

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
