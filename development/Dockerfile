# syntax=docker/dockerfile:1

# Base image: Node.js LTS (24) on Debian Trixie (13)
FROM node:24-trixie-slim AS wbs-dev

# WBS tests use the Selenium Standalone image, so no need for the embedded Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# hadolint global ignore=DL3059
SHELL [ "/bin/bash", "-o", "pipefail", "-c" ]

# Install necessary packages except Docker and PNPM
RUN apt-get update && \
    apt-get --no-install-recommends -y install \
        git \
        curl \
        jq \
        python3-pip \
        python3-venv \
        && ln -sf /usr/bin/python3 /usr/bin/python \
        && rm -rf /var/lib/apt/lists/*

# Install Docker CLI
RUN curl -fsSL https://get.docker.com -o get-docker.sh && \
    bash get-docker.sh && \
    rm get-docker.sh

# Install hadolint Dockerfile linter (supports both AMD64 and ARM64)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
        curl -L https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-x86_64 -o /usr/local/bin/hadolint; \
    elif [ "$ARCH" = "aarch64" ]; then \
        curl -L https://github.com/hadolint/hadolint/releases/latest/download/hadolint-Linux-arm64 -o /usr/local/bin/hadolint; \
    fi && \
    chmod +x /usr/local/bin/hadolint

# Set up Python virtual environment for Python formatting
RUN python3 -m venv /root/venv && \
    /root/venv/bin/pip install --no-cache-dir --upgrade \
        pip \
        setuptools \
        black

WORKDIR /workspace/development

# Setup Git
RUN git config --global --add safe.directory /workspace

# Install pnpm through the package-manager shim bundled with Node.js.
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate

# Install the locked workspace dependencies in a cacheable image layer. Keep
# the snapshot outside /workspace so its contents remain available when the
# checkout and its node_modules volumes are mounted over that directory.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY images/wbs-tools/package.json images/wbs-tools/package.json

ARG WBS_DEV_IMAGE_FINGERPRINT
ENV WBS_DEV_IMAGE_FINGERPRINT=${WBS_DEV_IMAGE_FINGERPRINT}
LABEL org.wikibase-suite.wbs-dev.fingerprint=${WBS_DEV_IMAGE_FINGERPRINT}

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile && \
    pnpm exec shellcheck --version > /dev/null && \
    dependency_state_hash=$( \
        { \
            sha256sum package.json pnpm-lock.yaml pnpm-workspace.yaml; \
            pnpm --version; \
            node --version; \
        } | sha256sum | cut -d ' ' -f 1 \
    ) && \
    printf '%s\n' "$dependency_state_hash" > node_modules/.wbs-dev-dependencies && \
    mkdir -p /opt/wbs-dev-dependencies/images/wbs-tools && \
    mv node_modules /opt/wbs-dev-dependencies/node_modules && \
    mv images/wbs-tools/node_modules \
        /opt/wbs-dev-dependencies/images/wbs-tools/node_modules

# Add npm module bins and activate Python venv virtual environment
ENV PATH="/workspace/development/node_modules/.bin:/root/venv/bin:$PATH"

ENTRYPOINT [ "./lib/container-entrypoint.sh" ]
