FROM node:jod-slim AS builder

WORKDIR /usr/app

RUN apt-get update
RUN apt-get install -y python3 build-essential
RUN npm config delete proxy

COPY package.json yarn.lock ./
RUN yarn install --immutable --immutable-cache --check-cache

COPY . .
RUN yarn build

FROM node:jod-slim AS runner

WORKDIR /usr/app
COPY --from=builder /usr/app/ ./

VOLUME /usr/app/data

CMD ["node", "./dist/index.js", "--enable-source-maps"]
