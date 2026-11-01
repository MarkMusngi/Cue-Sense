# Development image. Build context is the repo root, so the pnpm workspace files are available.
FROM node:26-alpine

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter web

COPY apps/web apps/web

EXPOSE 3000
CMD ["pnpm", "--filter", "web", "dev", "--hostname", "0.0.0.0"]
