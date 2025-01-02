FROM node:22-alpine
WORKDIR /app
RUN apk update && \
  apk add --no-cache git && \
  npm install -g bun
COPY package.json bun.lockb index.ts ./
RUN bun install -p
ENV PORT=4000 WEBHOOK_PORT=3000
ENTRYPOINT [ "bun", "run", "index.ts" ]
