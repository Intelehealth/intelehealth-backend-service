FROM node:18-alpine

WORKDIR /app

# Runtime + native build dependencies.
# Required particularly for native modules such as canvas on Alpine/ARM64.
RUN apk add --no-cache \
    dumb-init \
    curl \
    libc6-compat \
    python3 \
    make \
    g++ \
    gcc \
    musl-dev \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    freetype-dev

# Copy dependency manifests first for Docker layer caching
COPY package.json package-lock.json ./

# Show exactly what architecture npm sees
RUN echo "Node: $(node --version)" && \
    echo "npm: $(npm --version)" && \
    echo "arch: $(node -p 'process.arch')" && \
    echo "platform: $(node -p 'process.platform')" && \
    uname -a

# Alpine + ARM64 frequently needs native modules compiled locally.
RUN npm ci --build-from-source --verbose || \
    ( \
      echo "========== NPM INSTALL FAILED ==========" && \
      echo "Architecture: $(node -p 'process.arch')" && \
      echo "Platform: $(node -p 'process.platform')" && \
      echo "========== NPM LOGS ==========" && \
      find /root/.npm/_logs \
        -type f \
        -name "*.log" \
        -exec cat {} \; && \
      exit 1 \
    )

# Application source
COPY . .

EXPOSE 3004

HEALTHCHECK \
  --interval=30s \
  --timeout=3s \
  --start-period=10s \
  --retries=3 \
  CMD curl -fsS \
    -H "X-Healthcheck-Token: ${HEALTHCHECK_TOKEN:-}" \
    "http://127.0.0.1:${PORT:-3004}/health" || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["npm", "start"]
