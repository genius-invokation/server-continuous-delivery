FROM oven/bun:1
WORKDIR /app
RUN apt-get update && apt-get install -y git && apt-get clean
COPY index.ts .
ENTRYPOINT [ "bun", "run", "index.ts" ]
