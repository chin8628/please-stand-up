FROM node:16-slim AS builder

WORKDIR /usr/app

RUN apt-get update
RUN apt-get install -y python3 build-essential
RUN npm config delete proxy

COPY package.json yarn.lock ./
RUN yarn install --immutable --immutable-cache --check-cache

COPY . .
RUN yarn build
RUN rm -rf node_modules

FROM node:16-slim AS runner

WORKDIR /usr/app
COPY --from=builder /usr/app/ ./

RUN mkdir /data
RUN echo "{}" > /data/alias.json
RUN chmod 777 /data/alias.json

VOLUME /data

CMD ["node", "./dist/index.js", "--enable-source-maps"]
