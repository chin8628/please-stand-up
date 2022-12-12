FROM node:16

WORKDIR /usr/app

COPY package.json yarn.lock ./
RUN yarn

COPY . .
RUN yarn build -- -b

RUN echo "{}" > ./dist/alias.json
RUN chmod 777 ./dist/alias.json

CMD ["yarn", "start:prod"]
