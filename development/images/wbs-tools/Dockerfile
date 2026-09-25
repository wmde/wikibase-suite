FROM node:24-alpine AS build

WORKDIR /workspace/development

RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY images/wbs-tools/package.json ./images/wbs-tools/package.json
RUN pnpm --filter wbs-tools install --frozen-lockfile

COPY images/wbs-tools ./images/wbs-tools
RUN pnpm --filter wbs-tools build && \
    pnpm --filter wbs-tools --prod deploy /app && \
    cp -R images/wbs-tools/web/public/assets /app/web/public/ && \
    test -s /app/web/public/assets/installer-app.css

FROM node:24-alpine

ARG WBS_TOOLS_VERSION
LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-suite"
LABEL org.opencontainers.image.version="${WBS_TOOLS_VERSION}"

WORKDIR /app
ENV NODE_ENV=production
ENV WBS_TOOLS_VERSION=${WBS_TOOLS_VERSION}

RUN apk add --no-cache bash docker-cli docker-cli-compose git openssl curl python3

COPY --from=build /app ./

CMD ["node", "dist/web/server.js"]
