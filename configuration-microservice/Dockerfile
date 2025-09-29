# --- Stage 1: Builder ---
FROM node:18-alpine AS builder

WORKDIR /app

# Install necessary build tools (only needed for the builder stage)
RUN apk update && apk add --no-cache \
    python3 make g++ gcc libc-dev pkgconfig \
    # ... (other build dependencies like cairo-dev, etc. from your original list)

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --legacy-bundling

# Copy application source code
COPY . .

# Run the build command
RUN npm run build

# --- Stage 2: Production/Runner ---
# Use a minimal base image for the final runtime
FROM node:18-alpine AS runner

# Install only runtime-specific dependencies if needed (e.g., dumb-init, libc6-compat)
# Use a minimal set from your original list
RUN apk update && apk add --no-cache \
    dumb-init \
    libc6-compat \
    # Add any runtime dependencies like image libraries if needed by the built code
    pixman cairo pango jpeg gif librsvg

WORKDIR /app

# Copy only the necessary files from the builder stage
# Copy built code (the 'dist' folder)
COPY --from=builder /app/dist ./dist
# Copy package.json and node_modules (production dependencies)
COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Expose the port your app runs on
EXPOSE 4004

# Run the application using the built files
# The dumb-init wrapper is good practice for container entry points
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"] 
# *** CRITICAL: Replace 'dist/index.js' with your actual entry point ***
