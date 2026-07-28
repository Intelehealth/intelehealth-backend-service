FROM node:18-alpine

WORKDIR /app

# dumb-init for proper signal handling, curl for the /health check.
# (No native build toolchain needed — all deps are pure JS.)
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl && \
    rm -rf /var/cache/apk/*

# Copy package files first (better layer caching)
COPY package*.json ./

# Install dependencies (incl. devDeps so `npm run migrate` / sequelize-cli
# works via `docker exec` during deploy, same as the other services)
RUN npm ci

# Copy application code
COPY . .

# Expose the port the service runs on (matches PORT in .env)
EXPOSE 3600

# Start the application
CMD ["dumb-init", "npm", "start"]
