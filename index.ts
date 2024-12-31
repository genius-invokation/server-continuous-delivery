import { $ } from "bun";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { limitFunction } from "p-limit";

const WEBHOOK_PORT = process.env.WEBHOOK_PORT || "3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

const APP_PORT = process.env.PORT || "4000";
const GH_CLIENT_ID = process.env.GH_CLIENT_ID || "";
const GH_CLIENT_SECRET = process.env.GH_CLIENT_SECRET || "";
const IS_BETA = !!process.env.IS_BETA;

const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString("hex");

const verifySignature = (header: string | null, body: string) => {
  if (!header) {
    return false;
  }
  const [algorithm, signature] = header.split("=");
  const hash = createHmac(algorithm, WEBHOOK_SECRET).update(body).digest("hex");
  return hash === signature;
};

const REPOSITORY_URL = IS_BETA
  ? `https://github.com/genius-invokation/genius-invokation-beta`
  : `https://github.com/genius-invokation/genius-invokation`;
const BRANCH_NAME = IS_BETA ? `beta` : `main`;

const REPOSITORY_PATH = `/app/gi-tcg`;
const SERVER_PACKAGE_PATH = path.join(REPOSITORY_PATH, "packages", "server");
const DB_PATH = `/db`;

const DOTENV_CONTENT = `
DATABASE_URL="${pathToFileURL(path.join(DB_PATH, "dev.db"))}"
PORT=${APP_PORT}

OUTPUT_PATH=${DB_PATH}/output.log
ERROR_PATH=${DB_PATH}/error.log

GH_CLIENT_ID=${GH_CLIENT_ID}
GH_CLIENT_SECRET=${GH_CLIENT_SECRET}
JWT_SECRET=${JWT_SECRET}
`

const setup = async () => {
  if (!existsSync(path.join(REPOSITORY_PATH, "package.json"))) {
    await $`git clone -b ${BRANCH_NAME} ${REPOSITORY_URL} ${REPOSITORY_PATH}`;
    await Bun.write(path.join(SERVER_PACKAGE_PATH, ".env"), DOTENV_CONTENT);
  } else {
    await $`git pull origin ${BRANCH_NAME}`.cwd(REPOSITORY_PATH);
  }
  await $`bunx pm2 ping`.cwd(SERVER_PACKAGE_PATH);
  await build();
  await start();
};

const build = async () => {
  $.cwd(REPOSITORY_PATH);
  await $`bun install`;
  await $`bun run build:prod`;
  $.cwd(SERVER_PACKAGE_PATH);
  await $`bunx prisma generate`;
  await $`bunx prisma migrate deploy`;
}

const start = async () => {
  $.cwd(SERVER_PACKAGE_PATH);
  await $`bun run start`;
}

const stop = async () => {
  $.cwd(SERVER_PACKAGE_PATH);
  await $`bun run stop`.nothrow();
}

// 禁止重入
const update = limitFunction(async () => {
  await $`git pull origin ${BRANCH_NAME}`.cwd(REPOSITORY_PATH);
  await build();
  await start();
}, { concurrency: 1 });

await setup();

const status = async () => {
  return  await $`bun status`.cwd(SERVER_PACKAGE_PATH).text();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("SIGQUIT", stop);

const server = Bun.serve({
  fetch: async (req) => {
    const path = new URL(req.url).pathname;
    if (req.method === "POST" && path === "/webhook") {
      const body = await req.text();
      const signature = req.headers.get("X-Hub-Signature");
      if (!verifySignature(signature, body)) {
        return new Response("Invalid signature", { status: 403 });
      }
      const payload = JSON.parse(body);
      if (payload.ref !== `refs/heads/${payload.repository.default_branch}`) {
        return new Response("Not the default branch", { status: 200 });
      }
      update();
      return Response.json({ message: "OK" });
    }
    if (req.method === "GET" && path === "/") {
      return new Response(await status());
    }
    return new Response("Not found", { status: 404 });
  },
  port: WEBHOOK_PORT,
});

console.log(`Webhook server is running at ${server.url}`);
