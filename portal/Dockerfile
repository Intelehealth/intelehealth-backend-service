# ----------------------------------------------------------------------
# Stage 1: Build Stage (Builder)
# Installs all dependencies (including build tools for native packages)
# ----------------------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Install all necessary build and development dependencies
# The *-dev packages are ONLY needed here for `npm ci` to compile native modules
RUN apk update && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    pkgconfig \
    # Dependencies for graphical packages (like canvas, sharp, etc.)
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

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies. Build tools are available in this stage.
RUN npm ci --legacy-bundling

# Copy application code
COPY . .

# ----------------------------------------------------------------------
# Stage 2: Production Stage (Final Image)
# Only copies necessary runtime files and installs only runtime dependencies
# ----------------------------------------------------------------------
FROM node:18-alpine AS production

# Install only the *runtime* dependencies.
# This list is much smaller, removing all the "*-dev" and build packages.
RUN apk update && \
    apk add --no-cache \
    dumb-init \
    curl \
    libc6-compat \
    # Runtime libraries for native dependencies compiled in the builder stage
    pixman \
    cairo \
    pango \
    libjpeg \
    giflib \
    librsvg \
    # FIX: Add libuuid, which is a transitive runtime dependency of librsvg
    libuuid \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy only the essential files from the builder stage:
# 1. node_modules (which are now compiled)
# 2. package files (needed for npm start)
# 3. Application source code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY . .

# Expose the port your app runs on
EXPOSE 3004

# Use dumb-init to properly handle signals and zombie processes
CMD ["dumb-init", "npm", "start"]
