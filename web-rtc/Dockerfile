
# Multi-stage build to reduce final image size
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
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
    librsvg-dev

# Copy package files and install all dependencies (including devDependencies)
COPY package*.json ./
RUN npm ci

#RUN .
# Copy source code and build (if there's a build step)
COPY . .
# Uncomment if you have a build step: RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install only runtime dependencies and clean up in one layer
RUN apk add --no-cache \
    dumb-init \
    curl \
    libc6-compat \
    pixman \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    && rm -rf /var/cache/apk/* /tmp/* /var/tmp/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force && \
    rm -rf ~/.npm

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
# Copy other necessary files
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
