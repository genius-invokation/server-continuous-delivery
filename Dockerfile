FROM oven/bun:1
WORKDIR /app
RUN apt-get update && apt-get install -y git && apt-get clean
COPY package.json bun.lockb index.ts ./
RUN bun install -p && bun install -g node@22
ENV PORT=4000 WEBHOOK_PORT=3000
ENTRYPOINT [ "bun", "run", "index.ts" ]
