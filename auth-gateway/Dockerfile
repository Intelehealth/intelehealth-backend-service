FROM node:18-alpine

WORKDIR /app

# Install only essential runtime dependencies in a single layer
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
    && apk add --no-cache dumb-init \
    && rm -rf /var/cache/apk/*

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-bundling --only=production

# Remove build dependencies after installation
RUN apk del .build-deps

# Copy application code
COPY . .

# Expose the port your app runs on
EXPOSE 3030

# Use dumb-init for proper signal handling
CMD ["dumb-init", "npm", "start"]
