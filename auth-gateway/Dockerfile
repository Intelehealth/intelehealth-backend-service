FROM node:18-alpine AS builder

WORKDIR /app

RUN apk update && 
apk add --no-cache 
dumb-init 
curl 
libc6-compat 
python3 
make 
g++ 
gcc 
libc-dev 
pkgconfig 
pixman-dev 
cairo-dev 
pango-dev 
jpeg-dev 
giflib-dev 
librsvg-dev


COPY package*.json ./

RUN npm ci --legacy-bundling

COPY . .

FROM node:18-alpine

WORKDIR /app

RUN apk update && 
apk add --no-cache 
dumb-init 
curl 
libc6-compat 
pixman 
cairo 
pango 
jpeg 
giflib 
librsvg 
&& rm -rf /var/cache/apk/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app .

EXPOSE 3030

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "start"]
