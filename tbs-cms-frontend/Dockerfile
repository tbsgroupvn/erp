# ============================================
# CMS Frontend - Next.js Dockerfile
# Multi-stage build for production optimization
# ============================================

# Stage 1: Dependencies (all deps needed for build)
FROM node:20-alpine AS deps
WORKDIR /app

# Install ALL dependencies (including devDeps for TypeScript, ESLint, Tailwind, etc.)
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Branding build args (baked into Next.js static build)
ARG NEXT_PUBLIC_COMPANY_NAME="My ERP"
ARG NEXT_PUBLIC_COMPANY_FULL_NAME="My ERP Company"
ARG NEXT_PUBLIC_APP_TITLE="CMS System"
ARG NEXT_PUBLIC_APP_DESCRIPTION="Content Management System"
ARG NEXT_PUBLIC_DOMAIN="localhost"
ARG NEXT_PUBLIC_AUTH_COOKIE="erp-auth"
ARG NEXT_PUBLIC_AUTH_STORAGE_NAME="erp-auth-storage"
ARG NEXT_PUBLIC_DEMO_MODE="false"
ARG NEXT_PUBLIC_API_URL=""

ENV NEXT_PUBLIC_COMPANY_NAME=$NEXT_PUBLIC_COMPANY_NAME
ENV NEXT_PUBLIC_COMPANY_FULL_NAME=$NEXT_PUBLIC_COMPANY_FULL_NAME
ENV NEXT_PUBLIC_APP_TITLE=$NEXT_PUBLIC_APP_TITLE
ENV NEXT_PUBLIC_APP_DESCRIPTION=$NEXT_PUBLIC_APP_DESCRIPTION
ENV NEXT_PUBLIC_DOMAIN=$NEXT_PUBLIC_DOMAIN
ENV NEXT_PUBLIC_AUTH_COOKIE=$NEXT_PUBLIC_AUTH_COOKIE
ENV NEXT_PUBLIC_AUTH_STORAGE_NAME=$NEXT_PUBLIC_AUTH_STORAGE_NAME
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build Next.js application
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# Set ownership to non-root user
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
