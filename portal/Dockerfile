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

# The server uses HTTPS in prod mode and HTTP otherwise. Probe the public
# health endpoint using the same protocol as the app; -k allows local probing
# when the mounted certificate is issued for the public hostname.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD if [ "$NODE_ENV" = "prod" ]; then curl -kfsS https://127.0.0.1:3004/health; else curl -fsS http://127.0.0.1:3004/health; fi || exit 1

# Start the application
CMD ["npm", "start"]
