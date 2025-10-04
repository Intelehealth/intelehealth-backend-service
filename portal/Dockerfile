# ----------  Build stage  ----------
FROM node:18-alpine AS builder

WORKDIR /build

# OS packages needed to compile native modules
RUN apk add --no-cache python3 make g++ gcc libc-dev pkgconfig \
    pixman-dev cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

# Install all deps (incl. dev)
COPY package*.json ./
RUN npm ci --legacy-bundling

# Copy source & build (if you have a build script)
COPY . .
RUN npm run build --if-present


# ----------  Runtime stage  ----------
FROM node:18-alpine

RUN apk add --no-cache dumb-init libc6-compat

# non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs
USER nodejs

WORKDIR /app

# copy production modules + code
COPY --from=builder --chown=nodejs:nodejs /build/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /build ./

EXPOSE 3004
CMD ["dumb-init","node","server.js"]   # <-- change entry file if needed
