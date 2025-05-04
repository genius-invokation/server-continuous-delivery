import { $ } from "bun";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { limitFunction } from "p-limit";

const WEBHOOK_PORT = process.env.WEBHOOK_PORT || "3000";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

const IS_BETA = !!process.env.IS_BETA;

const JWT_SECRET = process.env.JWT_SECRET || randomBytes(32).toString("hex");

const UPDATED_NOTIFY_URL = process.env.UPDATED_NOTIFY_URL || "";

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

OUTPUT_PATH=${DB_PATH}/output.log
ERROR_PATH=${DB_PATH}/error.log

JWT_SECRET="${JWT_SECRET}"
`;

const setup = async () => {
  if (!existsSync(path.join(REPOSITORY_PATH, "package.json"))) {
    await $`gh repo clone ${REPOSITORY_URL} ${REPOSITORY_PATH}`;
    await Bun.write(path.join(SERVER_PACKAGE_PATH, ".env"), DOTENV_CONTENT);
  } else {
    await sync();
  }
  await build();
  await start();
  await checkOnline(true);
};

const sync = async () => {
  $.cwd(REPOSITORY_PATH);
  await $`gh repo sync --force`;
};

const build = async () => {
  $.cwd(REPOSITORY_PATH);
  await $`bun install --frozen-lockfile`;
  await $`bun run build -n web-client server`;
  $.cwd(SERVER_PACKAGE_PATH);
  await $`bunx prisma migrate deploy`;
};

const start = async () => {
  $.cwd(SERVER_PACKAGE_PATH);
  await $`bun run pm2 ping`;
  await $`bun run start`;
};

const stop = async () => {
  $.cwd(SERVER_PACKAGE_PATH);
  await $`bun run stop`.nothrow();
};

const terminate = async () => {
  await stop(); 
  process.exit();
}

const status = async () => {
  $.cwd(SERVER_PACKAGE_PATH);
  return await $`bun status:detail`.text();
};

// 禁止重入
const update = limitFunction(
  async () => {
    await sync();
    await stop();
    await build();
    await start();
  },
  { concurrency: 1 }
);

const checkOnline = async (firstTime: boolean = false) => {
  await Bun.sleep(30 * 1000);
  $.cwd(SERVER_PACKAGE_PATH);
  const status = (await $`bun status`.text()).trim();
  const detail = (await $`bun status:detail`.text()).trim();
  const gitLog = await $`git log -1 --pretty=format:"%h - %an, %ad : %s" --date=format:"%Y-%m-%d %H:%M:%S"`.text();
  console.log(`App status check: ${status}`);
  if (UPDATED_NOTIFY_URL) {
    fetch(UPDATED_NOTIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        detail,
        gitLog: firstTime ? "(First Time Up)\n" + gitLog : gitLog,
        env: { IS_BETA },
      }),
    }).catch(() => {
      console.log(`Failed to notify ${UPDATED_NOTIFY_URL}`);
    });
  }
};

await setup();

process.on("SIGINT", terminate);
process.on("SIGTERM", terminate);
process.on("SIGQUIT", terminate);

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
      update()
        .finally(checkOnline)
        .catch(() => {});
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
