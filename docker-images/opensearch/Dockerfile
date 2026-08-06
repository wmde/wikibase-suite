ARG OPENSEARCH_IMAGE_URL

# ###########################################################################
# hadolint ignore=DL3006
FROM ${OPENSEARCH_IMAGE_URL}
LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-release-pipeline"
ARG OPENSEARCH_PLUGIN_WIKIMEDIA_EXTRA
ARG OPENSEARCH_PLUGIN_WIKIMEDIA_HIGHLIGHTER

RUN \
  /usr/share/opensearch/bin/opensearch-plugin install --batch \
    org.wikimedia.search:opensearch-extra:${OPENSEARCH_PLUGIN_WIKIMEDIA_EXTRA} && \
  /usr/share/opensearch/bin/opensearch-plugin install --batch \
    org.wikimedia.search.highlighter:cirrus-highlighter-opensearch-plugin:${OPENSEARCH_PLUGIN_WIKIMEDIA_HIGHLIGHTER}
COPY --chown=opensearch:opensearch \
  default.jvm.options \
  /usr/share/opensearch/config/jvm.options.d/wikibase.options
