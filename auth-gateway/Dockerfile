# Stage 1: Builder
FROM node:18-alpine AS builder
#A
WORKDIR /app
 


# Install build dependencies
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev

COPY package*.json ./
RUN npm ci --legacy-bundling

COPY . .
# If you have build step, uncomment:
# RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Install only RUNTIME dependencies (not dev packages)
RUN apk add --no-cache \
    dumb-init \
    cairo \
    pango \
    librsvg \
    giflib \
    libjpeg-turbo

# Copy package files
COPY package*.json ./
 

# Install production dependencies only
RUN npm ci --legacy-bundling --only=production

# Copy built application from builder stage
COPY --from=builder /app ./

# Clean up any unnecessary files
RUN rm -rf \
    /tmp/* \
    /var/cache/apk/* \
    /root/.npm \
    /root/.node-gyp

EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- --header="X-Healthcheck-Token: ${HEALTHCHECK_TOKEN:-}" \
  http://127.0.0.1:${PORT:-3030}/health || exit 1

CMD ["dumb-init", "npm", "start"]
