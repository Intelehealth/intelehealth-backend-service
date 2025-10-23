# --- Stage 1: Builder Stage ---
# Use a Node image with all necessary tools for compiling native modules (like 'canvas')
FROM node:18 AS builder

WORKDIR /app
#A
# Install package files first
COPY package*.json ./

# Install *all* dependencies (including devDependencies if they help compilation)
# We need g++ and make for packages with native extensions (like canvas)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    g++ \
    make \
    pkg-config \
    # These are the *build* dependencies for canvas and its required libraries
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install npm dependencies
RUN npm ci

# Copy application code
COPY . .

# --- Stage 2: Production/Runtime Stage ---
# Use the smallest possible image for runtime
FROM node:18-alpine

# Set environment variable
ENV NODE_ENV production

# Install only essential runtime dependencies and clean up
# These are the **runtime** dependencies for a compiled package like 'canvas' on Alpine
RUN apk update && \
    apk add --no-cache \
    dumb-init \
    libc6-compat \
    # Canvas Runtime Dependencies (Alpine)
    cairo \
    pango \
    libjpeg \
    giflib \
    librsvg \
    libuuid \
    # The development libraries (e.g., cairo-dev) are NOT needed here, 
    # only the base runtime libraries (e.g., cairo) are.
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy only the necessary files from the builder stage
# This includes the node_modules (which now contains the compiled 'canvas' module) 
# and the application code.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

# Expose the port your app runs on
EXPOSE 3004

# Start the application using dumb-init
CMD ["dumb-init", "npm", "start"]
