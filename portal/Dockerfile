# syntax=docker/dockerfile:1.6

FROM node:18-alpine AS builder
WORKDIR /app

RUN apk add --no-cache \
    python3 make g++ gcc libc-dev pkgconfig \
    cairo-dev pango-dev pixman-dev jpeg-dev giflib-dev librsvg-dev \
    freetype-dev fontconfig-dev 

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --legacy-bundling --build-from-source \
 && npm cache clean --force

COPY . .

FROM node:18-alpine AS runner
WORKDIR /app

RUN apk add --no-cache \
    dumb-init curl libc6-compat \
    cairo pango pixman jpeg giflib librsvg \
    freetype fontconfig util-linux-libs 

# Ensure the app dir is owned by the pre-existing 'node' user
RUN chown -R node:node /app

# Copy with ownership to avoid a separate chown of big trees
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node
ENV NODE_ENV=production
EXPOSE 3004
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
