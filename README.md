# `@gi-tcg/server` Continuous Delivery

This repo contains a Dockerfile and a Bun script that will...

- Build `@gi-tcg/server` from [source repo](https://github.com/genius-invokation/genius-invokation);
- When above repo has update on default `main` branch, graceful pull latest version and restart the server.

The "automatic update" is triggered by GitHub Webhooks. Should set a webhook POST to `http://{YOUR_HOST}:{WEBHOOK_PORT}/webhook`.

Below environment variable **MUST** be provided when launching the container:
- `GH_CLIENT_ID` and `GH_CLIENT_SECRET` to complet OAuth workflow;
- `WEBHOOK_SECRET` that configured in the GitHub Webhook settings.

Below environment variable could be used to configure the container's behavior:
- `PORT` The server's running port, defaults to 4000
- `WEBHOOK_PORT` The Webhook's listening port, defaults to 3000
- `JWT_SECRET` A random string for encrypting JWT.

