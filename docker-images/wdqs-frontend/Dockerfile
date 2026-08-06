ARG NGINX_IMAGE_URL
ARG NODE_IMAGE_URL
ARG WDQSQUERYGUI_COMMIT

# ###########################################################################
# hadolint ignore=DL3006
FROM ${NODE_IMAGE_URL} as builder

RUN git clone https://gerrit.wikimedia.org/r/wikidata/query/gui /tmp/wikidata-query-gui && \
    git -C /tmp/wikidata-query-gui checkout ${WDQSQUERYGUI_COMMIT} && \
    find /tmp/wikidata-query-gui -name ".git*" -exec rm -rf {} +

WORKDIR /tmp/wikidata-query-gui

COPY remove-wikidata-tools.patch empty-missing-examples-page.patch /tmp/
RUN patch -Np1 </tmp/remove-wikidata-tools.patch && \
    patch -Np1 </tmp/empty-missing-examples-page.patch

# don't install chromium, it is not used
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install the upstream's locked dependency set, including development dependencies
# needed by Grunt, then skip its auto_install task to retain that dependency set.
RUN npm ci && \
    npx grunt clean only_build

# ###########################################################################
# hadolint ignore=DL3006
FROM ${NGINX_IMAGE_URL}
LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-release-pipeline"

RUN apt-get update && \
    apt-get install -y --no-install-recommends jq && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/share/nginx/html

COPY --from=builder /tmp/wikidata-query-gui/build /usr/share/nginx/html
RUN echo "" > style.css
COPY logo.svg /usr/share/nginx/html/logo.svg
COPY entrypoint.sh /entrypoint.sh
COPY --chmod=755 healthcheck.sh /healthcheck.sh
COPY wdqs-frontend-config.json.template /templates/wdqs-frontend-config.json.template
COPY nginx-default.conf.template /templates/nginx-default.conf.template

RUN mkdir -p /config

ENV LANGUAGE=en \
    WIKIBASE_HOST="wikibase" \
    WDQS_HOST="wdqs" \
    WDQS_PORT="9999"

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
