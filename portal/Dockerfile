# --- Stage 1: Build Stage (Builder) ---
FROM node:18-alpine AS builder

# Install build dependencies for native modules (like canvas or sharp)
RUN apk update && \
    apk add --no-cache \
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
    dumb-init \
    curl \
    libc6-compat \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (with build tools available)
RUN npm ci --legacy-bundling

# Copy application code (optional, but good practice for a complete build stage)
COPY . .

# --- Stage 2: Production Stage (Final Image) ---
FROM node:18-alpine AS production

# Install only the *runtime* dependencies needed for the application to run.
# This often includes libc6-compat, curl, dumb-init, and any native dependencies' runtime libs.
RUN apk update && \
    apk add --no-cache \
    dumb-init \
    curl \
    libc6-compat \
    # Add runtime libraries for native dependencies installed in the builder stage
    pixman \
    cairo \
    pango \
    libjpeg \
    giflib \
    librsvg \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY . .

# Expose the port your app runs on
EXPOSE 3004

# Start the application
CMD ["npm", "start"]
