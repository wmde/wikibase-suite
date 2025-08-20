FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY public ./public
COPY views ./views
COPY server.ts ./server.ts
COPY logStreamer.ts ./logStreamer.ts
COPY serverHelpers.ts ./serverHelpers.ts

RUN apk add --no-cache bash
RUN npm ci && npx tsc

CMD ["node", "server.js"]
