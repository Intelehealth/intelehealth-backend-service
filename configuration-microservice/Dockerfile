FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Install all necessary dependencies (both build tools and runtime libraries)
RUN apk update && apk upgrade && \
    apk add --no-cache \
    # Runtime utilities
    dumb-init \
    libc6-compat \
    # Build tools for native modules (g++, make, python, etc.)
    python3 make g++ gcc libc-dev pkgconfig \
    # Libraries for graphics/images (if your app needs them at runtime or build time)
    pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev \
    && rm -rf /var/cache/apk/*

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies (will include devDependencies like typescript and all @types packages)
# 'npm ci' ensures an exact, clean install based on package-lock.json
RUN npm install ts-node && npm install typescript && npm ci --legacy-bundling

# Copy application source code (including all .ts files, build.ts, etc.)
COPY . .

# *** CRITICAL: Build the application to create the 'dist' folder ***
# This step must succeed after you fix the TSError by updating package.json.
RUN npm run build

# Expose the port your app runs on
EXPOSE 4004

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Set the final command to execute the built entry file
# IMPORTANT: Replace 'dist/index.js' with your actual built entry point if it's different.
CMD ["node", "dist/index.js"]
