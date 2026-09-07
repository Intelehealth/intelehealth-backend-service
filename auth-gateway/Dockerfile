FROM node:18-alpine

WORKDIR /app

# Build-time deps needed to compile native modules (e.g. canvas), plus their
# runtime shared libs -- both installed up front so npm install only runs once.
RUN apk add --no-cache \
    dumb-init \
    cairo \
    pango \
    librsvg \
    giflib \
    libjpeg-turbo \
    --virtual .build-deps \
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
    librsvg-dev

COPY package*.json ./
RUN npm cache clean --force && npm install --legacy-bundling --omit=dev && npm cache clean --force

COPY . .

# Native modules are already compiled; the build toolchain is dead weight from here on.
RUN apk del .build-deps && \
    rm -rf /tmp/* /var/cache/apk/* /root/.npm /root/.node-gyp

EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- --header="X-Healthcheck-Token: ${HEALTHCHECK_TOKEN:-}" \
  http://127.0.0.1:${PORT:-3030}/health || exit 1

CMD ["dumb-init", "npm", "start"]
