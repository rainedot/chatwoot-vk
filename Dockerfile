FROM node:18
WORKDIR /home/vk-chatwoot

RUN npm ci
ADD . .

CMD npm start
