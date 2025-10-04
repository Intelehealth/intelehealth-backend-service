# syntax=docker/dockerfile:1.6

# ---- Base (builder+runner) ----
FROM node:18-alpine AS base
WORKDIR /app

# Keep npm logs quiet and ensure prod installs by default
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn

# System deps: split into runtime vs build and drop build deps after install
# Many canvas/sharp-style libs need these runtimes; build deps are installed as a virtual package
RUN apk add --no-cache \
      dumb-init \
      curl \
      libc6-compat \
      # runtime libs for common native modules (canvas/sharp/etc.)
      pixman \
      cairo \
      pango \
      jpeg \
      giflib \
      librsvg \
    && apk add --no-cache --virtual .build-deps \
      python3 \
      make \
      g++ \
      gcc \
      libc-dev \
      pkgconfig

# ---- Dependencies layer (cached) ----
FROM base AS deps
# Copy only package manifests to maximize cache hits
COPY package*.json ./

# Use BuildKit cache for npm to greatly speed up reinstalls
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --legacy-bundling \
 && npm cache clean --force

# ---- App layer ----
FROM base AS app
# Bring in node_modules from deps stage (already pruned to production)
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the app (source)
COPY . .

# If you have a build step (e.g., Next.js, TS -> JS), uncomment:
# RUN --mount=type=cache,target=/root/.npm \
#     npm run build \
#  && npm cache clean --force

# Drop build deps; keep runtime libs only
RUN apk del .build-deps

# Use the non-root 'node' user provided by the image for safer runtime
RUN chown -R node:node /app
USER node

EXPOSE 3004

# Use dumb-init (already installed) to handle PID 1 correctly
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
