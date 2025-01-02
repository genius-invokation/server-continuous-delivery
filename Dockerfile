FROM node:22
WORKDIR /app
RUN apt-get update && \
  apt-get install -y git && \
  apt-get clean && \
  npm install -g bun
COPY package.json bun.lockb index.ts ./
RUN bun install -p
ENV PORT=4000 WEBHOOK_PORT=3000
ENTRYPOINT [ "bun", "run", "index.ts" ]
