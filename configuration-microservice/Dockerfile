FROM node:18-alpine

WORKDIR /app

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

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-bundling



# Copy application code
COPY . .

RUN npm run build

# Expose the port your app runs on
EXPOSE 4004

# Set the final command to execute the built entry file
# IMPORTANT: The entry point is dist/src/index.js based on the build output.
#CMD ["node", "-r", "module-alias/register", "dist/src", "--env=production"]
CMD ["npm", "start"]


