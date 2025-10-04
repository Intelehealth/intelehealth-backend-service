# --- STAGE 1: Build Stage ---
FROM node:18-slim AS builder

# Set working directory
WORKDIR /app

# Install necessary build tools and dependencies.
# We use node:18-slim instead of alpine initially for a potentially smoother build
# and then switch to a smaller image like node:18-alpine or gcr.io/distroless/nodejs18-debian11
# for the final stage. Since your original was alpine-based, we'll aim for a final alpine image.
# We include all the dev dependencies from your original.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    gcc \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first
COPY package*.json ./

# Install dependencies. Use npm ci for clean, reproducible installs.
# We don't need --legacy-bundling unless absolutely necessary, as it can be less performant.
RUN npm ci

# Copy application code
COPY . .

# Run tests if you have them (HIGHLY RECOMMENDED for DevSecOps)
# Example: RUN npm test

# Build application if needed (e.g., for frontend frameworks or TypeScript)
# Example: RUN npm run build

# --- STAGE 2: Runtime Stage (Slimmer and More Secure) ---
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dumb-init for process supervision and better signal handling (good practice)
# and curl (if needed for health checks/debugging)
RUN apk update && apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Copy only necessary files from the builder stage
# This includes node_modules, package files, and the compiled application code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

# Ensure correct permissions for running the application as a non-root user (DevSec Best Practice)
# If your application doesn't need root, this is a strong recommendation.
# Example: RUN adduser -D appuser
# Example: USER appuser

# Expose the port your app runs on
EXPOSE 3004

# Use dumb-init for secure and robust process management
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
