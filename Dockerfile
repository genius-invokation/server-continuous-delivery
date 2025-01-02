FROM oven/bun:alpine AS kawaii-bun

FROM node:lts-alpine
WORKDIR /app

RUN apk update && apk add --no-cache git openssl

COPY --from=kawaii-bun /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

COPY package.json bun.lockb index.ts ./
RUN bun install -p

ENV PORT=4000 WEBHOOK_PORT=3000
ENTRYPOINT [ "bun", "run", "index.ts" ]
