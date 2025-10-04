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

RUN apk update && apk add --no-cache \
    dumb-init \
    curl \
    # Correct runtime library packages for Alpine:
    # libcairo (already correct)
    # libpango (already correct)
    jpeg \
    giflib \
    librsvg \
    # Add other core dependencies that might be needed by the above libraries:
    libpng \
    libtiff \
    # Clean up
    && rm -rf /var/cache/apk/*

# Copy only necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

EXPOSE 3004
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
