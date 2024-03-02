FROM node:19-alpine as base

FROM base as deps
WORKDIR /app

COPY package*.json ./

RUN npm ci

FROM base as runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

CMD npm start
