# ---------------------------------------------------------
# 1. Build stage – everything that is only needed to build
# ---------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /build

# 1.1 Install OS packages required for *compiling* native modules
RUN apk add --no-cache python3 make g++ gcc libc-dev pkgconfig \
    pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

# 1.2 Bring in package files first (Docker layer cache)
COPY package*.json ./

# 1.3 Install *all* dependencies (including devDependencies)
RUN npm ci --legacy-bundling

# 1.4 Copy source and build (if you have a build script)
COPY . .
RUN npm run build --if-present   # no-op if no build script exists


# ---------------------------------------------------------
# 2. Runtime stage – only what the app needs to run
# ---------------------------------------------------------
FROM node:18-alpine AS runtime

# dumb-init + libc6-compat are the only runtime OS deps
RUN apk add --no-cache dumb-init libc6-compat

# Create and switch to non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs
USER nodejs

WORKDIR /app

# Copy dependency tree from builder (already trimmed by --omit=dev)
COPY --from=builder --chown=nodejs:nodejs /build/node_modules ./node_modules

# Copy built application code
COPY --from=builder --chown=nodejs:nodejs /build/dist ./dist 2>/dev/null || \
    COPY --from=builder --chown=nodejs:nodejs /build ./

# Expose port (unchanged)
EXPOSE 3004

# Start via dumb-init for proper signal forwarding
CMD ["dumb-init", "node", "dist/index.js"]   # adjust entry point if needed
