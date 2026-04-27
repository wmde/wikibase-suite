FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json tsconfig.json tsconfig.client.json vite.config.ts ./
COPY client ./client
COPY public ./public
COPY shared ./shared
COPY data ./data
COPY cli.ts ./cli.ts
COPY server.ts ./server.ts
COPY logStreamer.ts ./logStreamer.ts
COPY passwordPolicy.ts ./passwordPolicy.ts
COPY serverHelpers.ts ./serverHelpers.ts

RUN apk add --no-cache bash
RUN npm ci && npm run build

CMD ["node", "server.js"]
