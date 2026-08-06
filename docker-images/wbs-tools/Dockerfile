FROM node:24-alpine AS build

WORKDIR /workspace/development

RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

COPY development/package.json development/pnpm-lock.yaml development/pnpm-workspace.yaml ./
COPY docker-images/wbs-tools/package.json ../docker-images/wbs-tools/package.json
RUN pnpm --filter wbs-tools install --frozen-lockfile

COPY docker-images/wbs-tools ../docker-images/wbs-tools
RUN pnpm --filter wbs-tools build && \
    pnpm --filter wbs-tools --prod deploy /app && \
    cp -R ../docker-images/wbs-tools/web/public/assets /app/web/public/

FROM node:24-alpine

ARG WBS_TOOLS_VERSION
LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-release-pipeline"
LABEL org.opencontainers.image.version="${WBS_TOOLS_VERSION}"

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache bash docker-cli docker-cli-compose git openssl curl

COPY --from=build /app ./

CMD ["node", "dist/web/server.js"]
