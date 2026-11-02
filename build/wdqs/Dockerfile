ARG DEBIAN_IMAGE_URL
ARG JRE_IMAGE_URL

# ###########################################################################
# hadolint ignore=DL3006
FROM ${JRE_IMAGE_URL} as jre

# ###########################################################################
# hadolint ignore=DL3006
FROM ${DEBIAN_IMAGE_URL} as fetcher
ARG WDQS_VERSION

RUN apt-get update && \
    apt-get install --yes --no-install-recommends wget ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

# ---------------------------------------------------------------------------
# WDQS DISTRIBUTION SOURCE — TEMPORARY GITLAB WORKAROUND
#
# Archiva is the normal source, but it is unreliable due to
# https://phabricator.wikimedia.org/T426114. To switch back once that is fixed,
# uncomment the Archiva block and comment out the GitLab block. Keep exactly one
# of these RUN blocks enabled.
#
# Archiva source (disabled):
# RUN set -x; \
#     TARBALL="service-${WDQS_VERSION}-dist.tar.gz"; \
#     wget --no-verbose "https://archiva.wikimedia.org/repository/releases/org/wikidata/query/rdf/service/$WDQS_VERSION/$TARBALL"; \
#     SIGNATURE="$TARBALL".md5; \
#     wget --no-verbose "https://archiva.wikimedia.org/repository/releases/org/wikidata/query/rdf/service/$WDQS_VERSION/$SIGNATURE"; \
#     echo "$(cat $SIGNATURE)  $TARBALL" | md5sum -c; \
#     mkdir /tmp/wdqs-service; \
#     tar zxvf $TARBALL -C /tmp/wdqs-service --strip-components=1
#
# GitLab source (temporarily enabled):
RUN set -x; \
    TARBALL="service-${WDQS_VERSION}-dist.tar.gz"; \
    wget --no-verbose "https://gitlab.wikimedia.org/api/v4/projects/2745/packages/maven/org/wikidata/query/rdf/service/$WDQS_VERSION/$TARBALL"; \
    SIGNATURE="$TARBALL".md5; \
    wget --no-verbose "https://gitlab.wikimedia.org/api/v4/projects/2745/packages/maven/org/wikidata/query/rdf/service/$WDQS_VERSION/$SIGNATURE"; \
    echo "$(cat $SIGNATURE)  $TARBALL" | md5sum -c; \
    mkdir /tmp/wdqs-service; \
    tar zxvf $TARBALL -C /tmp/wdqs-service --strip-components=1
# ---------------------------------------------------------------------------

# ###########################################################################
# hadolint ignore=DL3006
FROM ${DEBIAN_IMAGE_URL}
LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-release-pipeline"

# Base as many images as possible on debian.
# eclipse-temurin is not available for debian, so we copy the JRE over from
# an eclipse-temurin ubuntu container.
# https://github.com/docker-library/docs/blob/master/eclipse-temurin/README.md#using-a-different-base-image
ENV JAVA_HOME=/opt/java/openjdk
COPY --from=jre $JAVA_HOME $JAVA_HOME
ENV PATH="${JAVA_HOME}/bin:${PATH}"

# Blazegraph scripts require bash
# Install curl for the loadData.sh wdqs script (if someone needs it)
SHELL [ "/bin/bash", "-o", "pipefail", "-c" ]
RUN apt-get update && \
    apt-get install --yes --no-install-recommends bash gettext curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    \
    addgroup --system blazegraph && \
    adduser --system \
        --gid "$(getent group blazegraph | cut -d: -f3)" \
        --shell /bin/bash blazegraph

COPY --from=fetcher --chown=blazegraph:blazegraph /tmp/wdqs-service /wdqs

RUN mkdir /var/log/wdqs && chown blazegraph /var/log/wdqs
RUN mkdir /wdqs/data && chown blazegraph /wdqs/data

# Don't set a memory limit otherwise bad things happen (OOMs)
ENV MEMORY=""\
    HEAP_SIZE="1g"\
    HOST="0.0.0.0"\
    WDQS_HOST="wdqs"\
    WDQS_PORT="9999"\
    WDQS_ENTITY_NAMESPACES="120,122"\
    WIKIBASE_SCHEME="http"\
    WIKIBASE_HOST="wikibase"\
    WIKIBASE_MAX_DAYS_BACK="90"\
    BLAZEGRAPH_EXTRA_OPTS=""\
    LOG_CONFIG="/wdqs/logback.xml"

EXPOSE 9999

WORKDIR /wdqs

COPY --chown=blazegraph:blazegraph wait-for-it.sh entrypoint.sh runBlazegraph.sh runUpdate.sh /
COPY --chown=blazegraph:blazegraph mwservices.json /templates/mwservices.json
COPY --chown=blazegraph:blazegraph RWStore.properties allowlist.txt logback.xml /wdqs/

# TODO this shouldn't be needed, but CI currently doesnt check for the +x bit, which is why this line is here
RUN chmod +x /wdqs/runUpdate.sh

USER blazegraph

ENTRYPOINT ["/entrypoint.sh"]
