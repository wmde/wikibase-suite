#!/usr/bin/env bash
set -euo pipefail

# --- Expected Variables ---

export DEPLOY_DIR
export DEBUG
export LOCALHOST
export LOG_PATH
export INSTALLER_DIR

# --- Bootstrap Logging ---

# shellcheck disable=SC1091
source "$SCRIPTS_DIR/_logging.sh"

# -- Script Specific Variables --

SERVER_IP=$(curl --silent --show-error --fail https://api.ipify.org || echo "127.0.0.1")
INSTALLER_IMAGE_NAME="${INSTALLER_IMAGE_NAME:-${SETUP_IMAGE_NAME:-wikibase/suite-installer-runtime}}"
WEB_DIR="$INSTALLER_DIR/web"

build_installer_runtime() {
  # BuildKit (via buildx with the docker-container driver) does not load images
  # into the local Docker image store by default. --load ensures it's available
  # to `docker run`.
  BUILDKIT_DRIVER=$(docker buildx inspect | grep 'Driver:' | awk '{print $2}')
  if [ "$BUILDKIT_DRIVER" = "docker-container" ]; then
    LOAD_FLAG="--load"
  else
    LOAD_FLAG=""
  fi

  run "docker build $LOAD_FLAG -t $INSTALLER_IMAGE_NAME -f $WEB_DIR/Dockerfile $WEB_DIR"
}

run_cli_config() {
  if [ -t 0 ] && [ -t 1 ]; then
    TTY_FLAGS="-it"
  else
    TTY_FLAGS="-i"
  fi

  docker run $TTY_FLAGS --rm \
    -e SERVER_IP="$SERVER_IP" \
    -e LOCALHOST="$LOCALHOST" \
    -v "$DEPLOY_DIR:/app/deploy" \
    -v "$LOG_PATH:/app/installation.log" \
    "$INSTALLER_IMAGE_NAME" \
    node dist/cli.js
}

echo
echo "🔧 Starting command-line installer..."
echo

debug "Starting installer runtime container..."
build_installer_runtime
run_cli_config
