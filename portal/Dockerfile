# ----------------------------------------------------------------------
# Stage 1: Build Stage (Builder)
# Installs all dependencies (including build tools for native packages)
# ----------------------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies in a single layer with comprehensive cleanup
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
    librsvg-dev \
    && apk add --no-cache \
    dumb-init \
    curl \
    libc6-compat

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with optimizations
RUN npm ci --legacy-bundling --no-audit --no-fund --prefer-offline \
    && npm cache clean --force \
    && rm -rf ~/.npm

# Copy application code
COPY . .

# ----------------------------------------------------------------------
# Stage 2: Production Stage (Final Image)
# Only copies necessary runtime files and installs only runtime dependencies
# ----------------------------------------------------------------------
FROM node:18-alpine AS production

# Install runtime dependencies and cleanup in single layer
RUN apk add --no-cache \
    dumb-init \
    curl \
    libc6-compat \
    pixman \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    libuuid \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-audit --no-fund --prefer-offline \
    && npm cache clean --force \
    && rm -rf ~/.npm /tmp/* /var/tmp/*

# Copy application code with proper ownership
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3004

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
