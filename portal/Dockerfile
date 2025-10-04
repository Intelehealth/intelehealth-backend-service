# syntax=docker/dockerfile:1.6

########################
# Builder (compiles deps like canvas)
########################
FROM node:18-alpine AS builder
WORKDIR /app

# Build tools + header packages required by node-canvas
# (runtime libs not strictly needed here, just the -dev ones)
RUN apk add --no-cache \
    python3 make g++ gcc libc-dev pkgconfig \
    cairo-dev pango-dev pixman-dev jpeg-dev giflib-dev librsvg-dev \
    freetype-dev fontconfig-dev

# Leverage cache: only package manifests first
COPY package*.json ./

# Build from source (avoids futile prebuilt fetch on musl)
# Use npm cache mount for speed
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --legacy-bundling --build-from-source \
 && npm cache clean --force

# Copy source last (doesn't invalidate dependency cache)
COPY . .

# If you have a build step, uncomment:
# RUN --mount=type=cache,target=/root/.npm npm run build

########################
# Runner (minimal runtime)
########################
FROM node:18-alpine AS runner
WORKDIR /app

# Runtime libs required by canvas at runtime (no *-dev here)
RUN apk add --no-cache \
    dumb-init curl libc6-compat \
    cairo pango pixman jpeg giflib librsvg \
    freetype fontconfig

# Copy only what's needed to run
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# Security: run as non-root
RUN addgroup -S nodegrp && adduser -S node -G nodegrp \
 && chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 3004

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
