# --- STAGE 1: Build Stage (using Alpine) ---
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies for Alpine (musl-compatible).
# Note: You were missing 'nasm' which is often needed for canvas on Alpine.
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
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
    nasm \
    && rm -rf /var/cache/apk/*

# Copy package files first
COPY package*.json ./

# Install dependencies. This will compile native modules against musl.
RUN npm ci

# Copy application code
COPY . .

# --- STAGE 2: Runtime Stage (using Alpine) ---
FROM node:18-alpine

WORKDIR /app

# Install necessary runtime dependencies (only curl and dumb-init).
RUN apk update && apk add --no-cache \
    dumb-init \
    curl \
    # IMPORTANT: Re-add the runtime libraries needed for 'canvas' on Alpine
    libcairo \
    libpango \
    libjpeg \
    libgif \
    librsvg \
    # The libc6-compat provides a compatibility layer for glibc, but it's
    # better to rely on musl-native libs where possible. If the above still fails,
    # you might re-introduce libc6-compat here as a last resort:
    # libc6-compat \
    && rm -rf /var/cache/apk/*

# Copy only necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

EXPOSE 3004
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
