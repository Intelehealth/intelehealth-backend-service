# Dockerfile for configuration-microservice
FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
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
    librsvg-dev \
    && rm -rf /var/cache/apk/*

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-bundling

# Copy application code (excluding .pem files)
COPY . .

# Create .pem directory structure but don't copy actual .pem files
# These will be mounted at runtime
RUN mkdir -p src/.pem

# Build the application
RUN npm run build

# Expose the port your app runs on
EXPOSE 4004

# Set the final command to execute the built entry file
CMD ["npm", "start"]
