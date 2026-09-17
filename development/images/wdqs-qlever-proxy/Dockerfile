ARG BUILD_IMAGE
ARG RUNTIME_IMAGE

# ###########################################################################
# Build the pinned Foundation source on the target architecture. The output is
# the target/quarkus-app tree consumed by the upstream Blubber production
# variant. The BuildKit Maven cache makes repeated local and CI builds cheap.
FROM ${BUILD_IMAGE} AS builder
ARG WDQS_PROXY_REPOSITORY
ARG WDQS_PROXY_COMMIT
ARG TARGETARCH

COPY build/disable-eventgate-by-default.patch /tmp/disable-eventgate-by-default.patch

RUN apt-get update && \
    apt-get install --yes --no-install-recommends git ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    git clone "$WDQS_PROXY_REPOSITORY" /src/wdqs-proxy && \
    git -C /src/wdqs-proxy checkout --detach "$WDQS_PROXY_COMMIT" && \
    test "$(git -C /src/wdqs-proxy rev-parse HEAD)" = "$WDQS_PROXY_COMMIT" && \
    git -C /src/wdqs-proxy apply --check /tmp/disable-eventgate-by-default.patch && \
    git -C /src/wdqs-proxy apply /tmp/disable-eventgate-by-default.patch

WORKDIR /src/wdqs-proxy
RUN --mount=type=cache,id=wdqs-proxy-maven-${TARGETARCH},target=/root/.m2 \
    EVENTGATE_ENABLED=true ./mvnw verify

# ###########################################################################
# This runtime layout and Java invocation match the upstream Blubber production
# variant. The source remains upstream GPL-2.0-only code; this image packages
# it as a separate runtime service.
FROM ${RUNTIME_IMAGE}
LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-suite"

RUN apt-get update && \
    apt-get install --yes --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /src/wdqs-proxy/target/quarkus-app/lib/ /lib/
COPY --from=builder /src/wdqs-proxy/target/quarkus-app/*.jar /
COPY --from=builder /src/wdqs-proxy/target/quarkus-app/app/ /app/
COPY --from=builder /src/wdqs-proxy/target/quarkus-app/quarkus/ /quarkus/
COPY --from=builder /src/wdqs-proxy/LICENSE /usr/share/licenses/wdqs-proxy/LICENSE
COPY runtime/ /
RUN chmod 755 /usr/local/bin/entrypoint.sh /usr/local/bin/healthcheck.sh

# Standard prefixes support the familiar WDQS service vocabulary. Deliberately
# do not inject Wikidata entity/property prefixes: a Suite wiki has its own RDF
# base and that policy is configured separately from label-service support.
ENV QUARKUS_HTTP_PORT=8090 \
    QUARKUS_REST_CLIENT_DOWNSTREAM_SPARQL_ENDPOINT_URL=http://qlever:7001 \
    QUERY_REWRITER_INJECT_STANDARD_PREFIXES=true \
    QUERY_REWRITER_INJECT_WIKIDATA_PREFIXES=false \
    QUERY_REWRITER_MW_SPARQL_ENABLED=false \
    QUERY_REWRITER_PATH_SEARCH_ENABLED=false \
    QUERY_REWRITER_FEDERATION_ENABLED=false \
    EVENTGATE_ENABLED=false

EXPOSE 8090
HEALTHCHECK --interval=10s --start-period=2m CMD ["/usr/local/bin/healthcheck.sh"]
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
