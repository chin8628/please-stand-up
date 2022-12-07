FROM node:16

WORKDIR /usr/app

COPY package.json yarn.lock ./
RUN yarn

COPY . .
RUN yarn build -- -b

CMD ["yarn", "start:prod"]
