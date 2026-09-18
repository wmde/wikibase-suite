ARG BUILD_IMAGE=maven:3.9-eclipse-temurin-25
ARG RUNTIME_IMAGE=amazoncorretto:25-alpine@sha256:4955796538972099d9c7de6e31c6a259b1de65393a58b7e0996b7cc50d7d20a7

# Build the updater against the released Foundation WDQS Common library. Its
# Munger and RDF model are canonical; this image owns only the self-hosted
# orchestration around them.
FROM ${BUILD_IMAGE} AS updater-builder
ARG TARGETARCH

COPY build/qlever-updater /src/qlever-updater

WORKDIR /src/qlever-updater
RUN --mount=type=cache,id=wdqs-common-maven-${TARGETARCH},target=/root/.m2 \
    mvn -B package \
      -Dcheckstyle.skip=true -Dspotbugs.skip=true -Dforbiddenapis.skip=true -Dmaven.javadoc.skip=true

# The runtime is deliberately Java-only: no PHP interpreter or second process
# boundary remains after the updater's operational code moved into the JAR.
# Corretto's Alpine runtime is published for both amd64 and arm64 and keeps
# this Java-only image substantially smaller than a general Ubuntu JRE.
FROM ${RUNTIME_IMAGE}

LABEL org.opencontainers.image.source="https://github.com/wmde/wikibase-suite"

# This process transforms bounded entity snapshots; it must not use the JVM's
# host-wide heap heuristic and contend with the query engine it maintains.
# Operators can replace this with JAVA_TOOL_OPTIONS when a larger export chunk
# or their deployment warrants it.
ENV JAVA_TOOL_OPTIONS="-Xms16m -Xmx128m"

COPY runtime/updater/entrypoint.sh /updater/entrypoint.sh
COPY runtime/usr/local/bin/healthcheck.sh /usr/local/bin/healthcheck.sh
COPY --from=updater-builder /src/qlever-updater/target/wdqs-qlever-updater.jar /updater/wdqs-qlever-updater.jar
RUN chmod 755 /updater/entrypoint.sh /usr/local/bin/healthcheck.sh

HEALTHCHECK --interval=15s --timeout=5s --start-period=2m CMD ["/usr/local/bin/healthcheck.sh"]
ENTRYPOINT ["/updater/entrypoint.sh"]
CMD ["updater"]
