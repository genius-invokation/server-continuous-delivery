FROM oven/bun:latest AS bun-builder

FROM node:lts-alpine
WORKDIR /app

RUN apk update && apk add --no-cache git openssl

COPY --from=bun-builder /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lockb index.ts ./

RUN bun install -p

ENV PORT=4000 WEBHOOK_PORT=3000

ENTRYPOINT [ "bun", "run", "index.ts" ]
