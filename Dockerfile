FROM oven/bun:alpine AS kawaii-bun

FROM node:lts-alpine
WORKDIR /app

COPY --from=kawaii-bun /usr/local/bin/bun /usr/local/bin/bun
COPY package.json bun.lockb index.ts ./
RUN apk update \
  && apk add --no-cache git openssl \
  && ln -s /usr/local/bin/bun /usr/local/bin/bunx \
  && bun install -p

ENV PORT=4000 WEBHOOK_PORT=3000
ENTRYPOINT [ "bun", "run", "index.ts" ]
