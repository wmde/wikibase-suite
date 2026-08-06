#!/usr/bin/env bash
set -euo pipefail

# --- Expected Variables ---

export WBS_DIR
export INSTALLER_DEV
export INSTALLER_DEV_MOCK
export DEBUG
export LOCALHOST
export LAUNCH_TRIGGER_PATH
export SCRIPTS_DIR
export WBS_STATE_DIR
export CONFIGURE_ONLY
CONFIGURE_ARGS=( "$@" )

# --- Bootstrap Logging ---

# shellcheck disable=SC1091
source "$SCRIPTS_DIR/_logging.sh"
# shellcheck disable=SC1091
source "$SCRIPTS_DIR/run-wbs-tools.sh"
# -- Script Specific Variables --

CERT_EMAIL="${CERT_EMAIL:-wbs-setup@wikimedia.de}"
INSTALLER_CONTAINER_NAME=${WBS_INSTALLER_CONTAINER_NAME:-wikibase-suite-installer-webserver}
INSTALLER_WORKER_CONTAINER_NAME=${WBS_INSTALLER_WORKER_CONTAINER_NAME:-wikibase-suite-installer-worker}
INSTALLER_PORT=${WBS_INSTALLER_PORT:-8888}
SERVER_IP=$(curl --silent --show-error --fail https://api.ipify.org || echo "127.0.0.1")
CERTBOT_IMAGE="${CERTBOT_IMAGE:-certbot/certbot:v4.2.0}"
WBS_TOOLS_PROJECT_DIR="$WBS_DIR/docker-images/wbs-tools"
LE_DIR="$WBS_STATE_DIR/letsencrypt"
CERTS_DIR="$WBS_STATE_DIR/certs"
LAUNCH_TRIGGER_PATH="${LAUNCH_TRIGGER_PATH:-$WBS_STATE_DIR/install-request}"
LAUNCH_TRIGGER_CONTAINER_PATH="/app/state/install-request"
EXISTING_INSTALL_STATE="${EXISTING_INSTALL_STATE:-none}"

# --- Functions ---

generate_cert_for_installer_webserver() {
  debug "Requesting a trusted HTTPS certificate for the installer page (ACME via Let’s Encrypt)..."

  if $LOCALHOST; then
    INSTALLER_HOST="localhost"
  else
    # Extra random suffix helps avoid LE rate limits during repeated runs
    local installer_suffix
    printf -v installer_suffix '%04x%04x' "$RANDOM" "$RANDOM"
    INSTALLER_SUBDOMAIN="wbs-installer-$installer_suffix"
    INSTALLER_HOST="$INSTALLER_SUBDOMAIN.$SERVER_IP.nip.io"
  fi

  run "mkdir -p $LE_DIR $CERTS_DIR"
  debug "Using domain: $INSTALLER_HOST"

  if ! $LOCALHOST; then
    if run "docker run --rm \
      -v $LE_DIR:/etc/letsencrypt \
      -v $CERTS_DIR:/certs \
      -p 80:80 \
      $CERTBOT_IMAGE certonly \
        --standalone \
        --non-interactive \
        --preferred-challenges http \
        --agree-tos \
        --email $CERT_EMAIL \
        -d $INSTALLER_HOST"; then

      LE_CERT_PATH="$LE_DIR/live/$INSTALLER_HOST"

      if [ -f "$LE_CERT_PATH/fullchain.pem" ] && [ -f "$LE_CERT_PATH/privkey.pem" ]; then
        cp "$LE_CERT_PATH/fullchain.pem" "$CERTS_DIR/cert.pem"
        cp "$LE_CERT_PATH/privkey.pem" "$CERTS_DIR/key.pem"
        return 0
      fi
    fi
  fi

  # Fallback: self-signed cert
  run "openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -out $CERTS_DIR/cert.pem \
    -keyout $CERTS_DIR/key.pem \
    -subj /CN=$INSTALLER_HOST"
  SELF_SIGNED_CERT=true
}

remove_any_existing_installer_webserver() {
  # Remove any existing installer container with our fixed name (running or exited).
  run "docker rm -fv $INSTALLER_CONTAINER_NAME >/dev/null 2>&1 || true"
  run "docker rm -fv $INSTALLER_WORKER_CONTAINER_NAME >/dev/null 2>&1 || true"

  # Optional: warn if the host port is already taken (by something else)
  if command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:"$INSTALLER_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      status "⛔️ Port $INSTALLER_PORT required by the installer appears already in use on this server"
    fi
  fi
}

start_installer_worker() {
  local worker_args=(install-worker)
  if [[ "${WBS_BUILD_IMAGES:-false}" == true ]]; then
    worker_args+=(--build)
  elif [[ "${WBS_LOCAL_IMAGES:-false}" == true ]]; then
    worker_args+=(--local-images)
  fi
  prepare_wbs_tools_environment_args

  run_args docker run -d --rm \
    --name "$INSTALLER_WORKER_CONTAINER_NAME" \
    --network none \
    -e "WBS_DIR=$WBS_DIR" \
    -e "ENV_FILE_PATH=$ENV_FILE_PATH" \
    -e "LOG_PATH=$LOG_PATH" \
    -e "LAUNCH_TRIGGER_PATH=$LAUNCH_TRIGGER_PATH" \
    "${WBS_TOOLS_ENVIRONMENT_ARGS[@]}" \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$WBS_DIR:$WBS_DIR" \
    -w "$WBS_DIR" \
    "$WBS_TOOLS_IMAGE" \
    node /app/dist/wbs.js "${worker_args[@]}"
}

compose_services_are_running() {
  pushd "$WBS_DIR" >/dev/null || return 1

  local compose_opts=(-f docker-compose.yml)
  if [ -f "docker-compose.local.yml" ]; then
    compose_opts+=(-f docker-compose.local.yml)
  fi
  if [[ "${WBS_LOCAL_IMAGES:-false}" == true ]]; then
    compose_opts+=(-f development/docker-compose.local-images.yml)
  fi

  local running_services
  running_services="$(docker compose "${compose_opts[@]}" ps --services --status running 2>/dev/null | sed '/^[[:space:]]*$/d' || true)"
  popd >/dev/null || return 1

  [ -n "$running_services" ]
}

detect_existing_install_state() {
  if compose_services_are_running; then
    echo "running"
  elif [ -f "$WBS_DIR/config/LocalSettings.php" ]; then
    echo "previous"
  else
    echo "none"
  fi
}

start_installer_webserver() {
  local command

  # Ensure old container is gone before build/run
  remove_any_existing_installer_webserver
  mkdir -p "$WBS_STATE_DIR"
  touch "$ENV_FILE_PATH" "$LOG_PATH"
  rm -f "$LAUNCH_TRIGGER_PATH"

  # Run with volumes mapped as before
  if $INSTALLER_DEV; then
    command=(
      docker run -d
      --name "$INSTALLER_CONTAINER_NAME"
      -e "SERVER_IP=$SERVER_IP"
      -e "LOCALHOST=$LOCALHOST"
      -e "LAUNCH_TRIGGER_PATH=$LAUNCH_TRIGGER_CONTAINER_PATH"
      -e "EXISTING_INSTALL_STATE=$EXISTING_INSTALL_STATE"
      -e "CONFIGURE_ONLY=${CONFIGURE_ONLY:-false}"
      -e DEV_SERVER=true
      -e "INSTALLER_DEV_MOCK=${INSTALLER_DEV_MOCK:-false}"
      -p "$INSTALLER_PORT:443"
      -v "$WBS_DIR:/app/wbs:ro"
      -v "$ENV_FILE_PATH:/app/wbs/.env"
      -v "$WBS_STATE_DIR:/app/state"
      -v "$CERTS_DIR:/app/certs"
      -v "$LOG_PATH:/app/installation.log"
      -v "$WBS_TOOLS_PROJECT_DIR/web:/app/web"
      -v "$WBS_TOOLS_PROJECT_DIR/shared:/app/shared"
      "$WBS_TOOLS_IMAGE"
      npm run dev:server
    )
  else
    command=(
      docker run -d
      --name "$INSTALLER_CONTAINER_NAME"
      -e "SERVER_IP=$SERVER_IP"
      -e "LOCALHOST=$LOCALHOST"
      -e "LAUNCH_TRIGGER_PATH=$LAUNCH_TRIGGER_CONTAINER_PATH"
      -e "EXISTING_INSTALL_STATE=$EXISTING_INSTALL_STATE"
      -e "CONFIGURE_ONLY=${CONFIGURE_ONLY:-false}"
      -p "$INSTALLER_PORT:443"
      -v "$WBS_DIR:/app/wbs:ro"
      -v "$ENV_FILE_PATH:/app/wbs/.env"
      -v "$WBS_STATE_DIR:/app/state"
      -v "$CERTS_DIR:/app/certs"
      -v "$LOG_PATH:/app/installation.log"
      "$WBS_TOOLS_IMAGE"
      node dist/wbs.js configure "${CONFIGURE_ARGS[@]}"
    )
  fi

  run_args "${command[@]}"

  echo "Open the following URL in your browser to continue:"
  echo
  echo "https://$INSTALLER_HOST:$INSTALLER_PORT"
  echo
  if [[ "${SELF_SIGNED_CERT:-false}" == true ]]; then
    echo "⚠️ This installer page is using a temporary self-signed HTTPS certificate."
    echo "Your browser will likely show a warning before loading the page."
    echo "See the Troubleshooting section of the installer README for help"
    echo "if you want to bypass the warning or replace it with a trusted cert."
    echo
  fi
}

echo
if $INSTALLER_DEV; then
  echo "🔧 Launching web-based installer (dev mode with live reload)..."
else
  echo "🔧 Launching web-based installer..."
fi
echo

debug "Launching installer webserver container..."
EXISTING_INSTALL_STATE="$(detect_existing_install_state)"

# No need to cd; we reference absolute paths for build context and Dockerfile
generate_cert_for_installer_webserver
start_installer_webserver

if [[ "${CONFIGURE_ONLY:-false}" == true ]]; then
  docker wait "$INSTALLER_CONTAINER_NAME" >/dev/null
  docker rm "$INSTALLER_CONTAINER_NAME" >/dev/null 2>&1 || true
elif [[ "${INSTALLER_DEV_MOCK:-false}" == true ]]; then
  :
else
  start_installer_worker
fi
