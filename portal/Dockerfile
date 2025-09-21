# Use the official Node.js 18 Alpine image as base
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    curl \
    libc6-compat \
    && rm -rf /var/cache/apk/*

# Set production environment
ENV NODE_ENV=production
ENV PORT=3004
ENV HOSTNAME=0.0.0.0

# Create a non-root user with specific UID/GID for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nodejs

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production --frozen-lockfile && \
    npm cache clean --force && \
    rm -rf /tmp/*

# Copy application files
COPY --chown=nodejs:nodejs . .

# Create directory for logs and set permissions
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3004

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3004/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "bin/www"]
