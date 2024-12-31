import { createHmac } from "node:crypto";

const webhookSecret = process.env.WEBHOOK_SECRET || "";

const verifySignature = (header: string | null, body: string) => {
  if (!header) {
    return false;
  }
  const [algorithm, signature] = header.split("=");
  const hash = createHmac(algorithm, webhookSecret).update(body).digest("hex");
  return hash === signature;
};

Bun.serve({
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
      console.log(payload);
      return Response.json({ message: "Hello, world!" });
    }

    return new Response("Not found", { status: 404 });
  },
  port: 8080,
});
