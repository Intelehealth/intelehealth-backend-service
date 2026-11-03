FROM node:18-alpine

WORKDIR /app

RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    libc6-compat \
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
    && rm -rf /var/cache/apk/*

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci  --legacy-bundling

# Copy application code
COPY . .

# Expose the port your app runs on
EXPOSE 3004

# The app starts an HTTP server in non-prod mode and exposes /health on the app port.
# Using HTTPS + / will fail because the healthcheck is probing the wrong protocol/path.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3004/health || exit 1

# Start the application
CMD ["npm", "start"]
