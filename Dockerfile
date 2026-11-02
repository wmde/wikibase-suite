# Base image: Node.js LTS (20) on Debian Bookworm (12)
FROM node:20-bookworm-slim AS wbs-build-tools

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

# Set up Python virtual environment and install Python packages (for black and update_commits.py)
RUN python3 -m venv /root/venv && \
    /root/venv/bin/pip install --no-cache-dir --upgrade \
        pip \
        setuptools \
        requests \
        bs4 \
        lxml \
        black

WORKDIR /workspace

# Setup Git
RUN git config --global --add safe.directory /workspace

# Install PNPM
RUN curl -fsSL https://get.pnpm.io/install.sh | ENV="$HOME/.bashrc" SHELL="$(which bash)" PNPM_VERSION=9.6.0 bash -
ENV PATH="/root/.local/share/pnpm:${PATH}"

# Add npm module bins and activate Python venv virtual environment
ENV PATH="/workspace/node_modules/.bin:/root/venv/bin:$PATH"

# https://github.com/nrwl/nx/issues/27040
ENV NX_ISOLATE_PLUGINS=false

ENTRYPOINT [ "./entrypoint.sh" ]
