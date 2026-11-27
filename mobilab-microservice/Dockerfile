FROM node:18-alpine
WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package*.json ./
RUN npm cache clean --force && npm install --omit=dev && npm cache clean --force
# .env and .pem are excluded by .dockerignore - supply them at run time
COPY . .

EXPOSE 3070
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- --header="X-Healthcheck-Token: ${HEALTHCHECK_TOKEN:-}" \
  http://127.0.0.1:${PORT:-3070}/health || exit 1
CMD ["/usr/bin/dumb-init", "npm", "start"]
