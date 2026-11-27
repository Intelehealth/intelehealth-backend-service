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
#DUMMY 
# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci  

# Copy application code
COPY . .


# Expose the port your app runs on
EXPOSE 3000


HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 CMD curl -sk -o /dev/null https://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
