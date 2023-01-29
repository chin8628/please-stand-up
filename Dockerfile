FROM node:16

WORKDIR /usr/app

COPY package.json yarn.lock ./
RUN yarn

COPY . .
RUN yarn build -b

RUN mkdir /data
RUN echo "{}" > /data/alias.json
RUN chmod 777 /data/alias.json

VOLUME /data

CMD ["yarn", "start:prod"]
