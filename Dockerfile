FROM node:19-alpine as base

FROM base as deps
WORKDIR /app

COPY package*.json ./

RUN npm ci

FROM base as runner
WORKDIR /app
COPY . .

CMD npm start
