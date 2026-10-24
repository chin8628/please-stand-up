FROM node:22-bookworm-slim AS builder

WORKDIR /usr/app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 build-essential \
	&& rm -rf /var/lib/apt/lists/* \
	&& corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build && pnpm prune --prod

FROM node:22-bookworm-slim AS runner

WORKDIR /usr/app

ENV NODE_ENV=production

COPY --from=builder /usr/app/package.json ./
COPY --from=builder /usr/app/node_modules ./node_modules
COPY --from=builder /usr/app/dist ./dist

VOLUME /usr/app/data

CMD ["node", "--enable-source-maps", "./dist/index.js"]
