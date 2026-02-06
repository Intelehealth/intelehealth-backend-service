# No --platform flag needed here; it will detect the runner's architecture
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    pixman-dev \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    librsvg-dev \
    uuid-dev 
    
COPY package*.json ./
RUN npm ci
COPY . .

# Stage 2: Runtime
FROM node:18-alpine

ENV NODE_ENV production

# Runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    libc6-compat \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    pixman

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

EXPOSE 3004

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
