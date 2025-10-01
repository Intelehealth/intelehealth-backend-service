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

# Define build argument for environment file path
ARG ENV_FILE_PATH=env/production.env

# Copy the specified .env file to build context (if not already present)
# This allows the .env file to be pre-created by the CI/CD pipeline
RUN if [ ! -f .env ]; then \
      echo "Copying environment file from ${ENV_FILE_PATH}..."; \
      cp ${ENV_FILE_PATH} .env; \
    else \
      echo "Using existing .env file from build context..."; \
    fi

# Create .pem directory structure but don't copy actual .pem files
# These will be mounted at runtime
RUN mkdir -p src/.pem

# Build the application with environment variables from .env file
# The .env file is now available in the build context
RUN if [ -f .env ]; then \
      echo "Loading .env file for build process..."; \
      set -a && . ./.env && set +a && npm run build; \
    else \
      echo "No .env file found, using default values"; \
      npm run build; \
    fi

# Expose the port your app runs on
EXPOSE 4004

# Set the final command to execute the built entry file
CMD ["npm", "start"]
