# Multi-stage build for configuration-microservice
FROM node:18-alpine AS base

# Install system dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --legacy-bundling && \
    npm cache clean --force
# Build
RUN npm run build
# Copy application code
COPY --chown=nodejs:nodejs . .

# Create .pem directory (will be mounted at runtime)
RUN mkdir -p src/.pem && \
    chown -R nodejs:nodejs src/.pem

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4004

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4004/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
