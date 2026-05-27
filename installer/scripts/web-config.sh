#!/usr/bin/env bash
set -euo pipefail

# --- Expected Variables ---

export DEPLOY_DIR
export DEV
export DEBUG
export LOCALHOST
export LAUNCH_TRIGGER_PATH
export RESET
export SCRIPTS_DIR
export SETUP_DIR

# --- Bootstrap Logging ---

# shellcheck disable=SC1091
source "$SCRIPTS_DIR/_logging.sh"

# -- Script Specific Variables --

CERT_EMAIL="${CERT_EMAIL:-wbs-setup@wikimedia.de}"
SETUP_CONTAINER_NAME=wbs-deploy-setup-webserver
SETUP_PORT=8888
SERVER_IP=$(curl --silent --show-error --fail https://api.ipify.org || echo "127.0.0.1")
CERTBOT_IMAGE="${CERTBOT_IMAGE:-certbot/certbot:v4.2.0}"
WEB_IMAGE_NAME="${WEB_IMAGE_NAME:-wikibase/deploy-setup-webserver}"
WEB_DIR="$SETUP_DIR/web"
LE_DIR="$WEB_DIR/letsencrypt"
CERTS_DIR="$WEB_DIR/certs"
LAUNCH_TRIGGER_CONTAINER_PATH="/app/deploy/$(basename "${LAUNCH_TRIGGER_PATH:-.wbs-setup-launch-ready}")"
EXISTING_INSTALL_STATE="${EXISTING_INSTALL_STATE:-none}"

# --- Functions ---

generate_cert_for_setup_webserver() {
  debug "Requesting a trusted HTTPS certificate for the setup page (ACME via Let’s Encrypt)..."

  if $LOCALHOST; then
    SETUP_HOST="localhost"
  else
    # Extra random suffix helps avoid LE rate limits during repeated runs
    SETUP_SUBDOMAIN="wbs-setup-$(hexdump -n 3 -v -e '/1 "%02x"' /dev/urandom)"
    SETUP_HOST="$SETUP_SUBDOMAIN.$SERVER_IP.nip.io"
  fi

  run "mkdir -p $LE_DIR $CERTS_DIR"
  debug "Using domain: $SETUP_HOST"

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
        -d $SETUP_HOST"; then

      LE_CERT_PATH="$LE_DIR/live/$SETUP_HOST"

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
    -subj /CN=$SETUP_HOST"
  SELF_SIGNED_CERT=true
}

remove_any_existing_setup_webserver() {
  # Remove any existing container with our fixed name (running or exited)
  run "docker rm -fv $SETUP_CONTAINER_NAME >/dev/null 2>&1 || true"

  # Optional: warn if the host port is already taken (by something else)
  if command -v lsof >/dev/null 2>&1; then
    if lsof -iTCP:"$SETUP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      status "⛔️ Port $SETUP_PORT required for setup appears already in use on this server"
    fi
  fi
}

compose_services_are_running() {
  pushd "$DEPLOY_DIR" >/dev/null || return 1

  local compose_opts=()
  if [ -f "docker-compose.local.yml" ]; then
    compose_opts+=(-f docker-compose.yml -f docker-compose.local.yml)
  fi

  local running_services
  running_services="$(docker compose "${compose_opts[@]}" ps --services --status running 2>/dev/null | sed '/^[[:space:]]*$/d' || true)"
  popd >/dev/null || return 1

  [ -n "$running_services" ]
}

detect_existing_install_state() {
  if $RESET; then
    echo "none"
  elif compose_services_are_running; then
    echo "running"
  elif [ -f "$DEPLOY_DIR/config/LocalSettings.php" ]; then
    echo "previous"
  else
    echo "none"
  fi
}

start_setup_webserver() {
  # Ensure old container is gone before build/run
  remove_any_existing_setup_webserver

  # BuildKit (via buildx with the docker-container driver) does not load images
  # into the local Docker image store by default. --load ensures it's available
  # to `docker run`.
  BUILDKIT_DRIVER=$(docker buildx inspect | grep 'Driver:' | awk '{print $2}')
  if [ "$BUILDKIT_DRIVER" = "docker-container" ]; then
    LOAD_FLAG="--load"
  else
    LOAD_FLAG=""
  fi

  run "docker build $LOAD_FLAG -t $WEB_IMAGE_NAME -f $WEB_DIR/Dockerfile $WEB_DIR"

  # Run with volumes mapped as before
  if $DEV; then
    run "docker run -d \
      --name $SETUP_CONTAINER_NAME \
      -e SERVER_IP=$SERVER_IP \
      -e LOCALHOST=$LOCALHOST \
      -e LAUNCH_TRIGGER_PATH=$LAUNCH_TRIGGER_CONTAINER_PATH \
      -e EXISTING_INSTALL_STATE=$EXISTING_INSTALL_STATE \
      -e DEV_SERVER=true \
      -p $SETUP_PORT:443 \
      -v $DEPLOY_DIR:/app/deploy \
      -v $CERTS_DIR:/app/certs \
      -v $LOG_PATH:/app/setup.log \
      -v $WEB_DIR:/src \
      $WEB_IMAGE_NAME \
      sh -lc 'ln -sfn /app/node_modules /src/node_modules && cd /src && npm run dev:server'"
  else
    run "docker run -d \
      --name $SETUP_CONTAINER_NAME \
      -e SERVER_IP=$SERVER_IP \
      -e LOCALHOST=$LOCALHOST \
      -e LAUNCH_TRIGGER_PATH=$LAUNCH_TRIGGER_CONTAINER_PATH \
      -e EXISTING_INSTALL_STATE=$EXISTING_INSTALL_STATE \
      -p $SETUP_PORT:443 \
      -v $DEPLOY_DIR:/app/deploy \
      -v $CERTS_DIR:/app/certs \
      -v $LOG_PATH:/app/setup.log \
      $WEB_IMAGE_NAME"
  fi

  echo "To continue setup navigate to:"
  echo
  echo "  https://$SETUP_HOST:$SETUP_PORT"
  echo
  if [[ "${SELF_SIGNED_CERT:-false}" == true ]]; then
    echo "⚠️ This setup page is using a temporary self-signed HTTPS certificate."
    echo "Your browser will likely show a warning before loading the page."
    echo "See the Troubleshooting section of the Deploy Setup README for help"
    echo "if you want to bypass the warning or replace it with a trusted cert."
    echo
  fi
}

echo
if $DEV; then
  echo "🔧 Starting web-based setup tool (dev mode with live reload)..."
else
  echo "🔧 Starting web-based setup tool..."
fi
echo

debug "Starting setup page webserver container..."
EXISTING_INSTALL_STATE="$(detect_existing_install_state)"

# No need to cd; we reference absolute paths for build context and Dockerfile
generate_cert_for_setup_webserver
start_setup_webserver
