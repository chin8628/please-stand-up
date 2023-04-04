FROM node:16-slim

RUN apt-get update
RUN apt-get install -y python3 build-essential
RUN npm config delete proxy

WORKDIR /usr/app

COPY package.json yarn.lock ./
RUN yarn install --immutable --immutable-cache --check-cache

COPY . .
RUN yarn build -b

RUN mkdir /data
RUN echo "{}" > /data/alias.json
RUN chmod 777 /data/alias.json

VOLUME /data

CMD ["yarn", "start:prod"]
