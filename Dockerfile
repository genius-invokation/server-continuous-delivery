FROM oven/bun:alpine AS kawaii-bun
WORKDIR /bundle
COPY package.json bun.lock index.ts /bundle/
RUN bun install --frozen-lockfile --production && bun build --target=bun --outfile index.js index.ts

FROM oven/bun:alpine
WORKDIR /app

COPY --from=kawaii-bun /bundle/index.js /app/index.js
RUN apk update && apk add --no-cache git openssl curl && curl -sS https://webi.sh/gh | sh

ENV PORT=4000 WEBHOOK_PORT=3000
ENTRYPOINT [ "bun", "run", "index.js" ]
