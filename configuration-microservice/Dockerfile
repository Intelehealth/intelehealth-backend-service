# ----------------------------------------
# Stage 1: Builder - Installs dependencies and runs the build
# ----------------------------------------
FROM node:18-alpine AS builder

# Set the working directory
WORKDIR /app

# Install build-time dependencies (including packages needed for native module compilation)
# Note: These are removed in the final stage, reducing image size.
RUN apk update && apk add --no-cache \
    python3 make g++ gcc libc-dev pkgconfig \
    pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies, including devDependencies needed for the build (like typescript, ts-node, etc.)
RUN npm ci --legacy-bundling

# Copy application source code
COPY . .

# *** CRITICAL: Run the build command to generate the 'dist' folder ***
# This step must pass without the TSError you encountered.
RUN npm run build


# ----------------------------------------
# Stage 2: Runner - Minimal image to run the built application
# ----------------------------------------
FROM node:18-alpine AS runner

# Set the working directory
WORKDIR /app

# Install only the necessary runtime dependencies (no dev tools)
RUN apk update && apk add --no-cache \
    dumb-init \
    libc6-compat \
    # Add runtime libraries if the final built app needs them
    pixman cairo pango jpeg gif librsvg

# Copy only the necessary files from the builder stage
# 1. Copy built JavaScript code (the 'dist' folder)
COPY --from=builder /app/dist ./dist
# 2. Copy package.json (for reference/scripts)
COPY package.json ./
# 3. Copy production node_modules (dev dependencies are excluded)
COPY --from=builder /app/node_modules ./node_modules

# Expose the port your app runs on
EXPOSE 4004

# Use dumb-init for proper signal handling and zombie process reaping
ENTRYPOINT ["dumb-init", "--"]

# *** Set the final command to execute the built entry file ***
# IMPORTANT: Replace 'index.js' if your main built file has a different name.
CMD ["node", "dist/index.js"]
