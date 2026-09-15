ockerfile
# queue-microservice — production image
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
 
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
 
# .env and the JWT public key (.pem/) are provided at runtime via
# a mounted volume or env vars — they are gitignored and must not be baked
# into the image.
EXPOSE 3600
CMD ["node", "server.js"]
