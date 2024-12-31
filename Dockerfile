FROM oven/bun:1
WORKDIR /app
RUN apt-get update && apt-get install -y git && apt-get clean
COPY package.json bun.lockb index.ts ./
RUN bun install -p
ENTRYPOINT [ "bun", "run", "index.ts" ]
