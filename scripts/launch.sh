#!/usr/bin/env bash
set -euo pipefail

# --- Expected Variables ---

export DEBUG
export LOCALHOST
export LOG_PATH
export DEPLOY_DIR
export ENV_FILE_PATH
export SCRIPTS_DIR
export SETUP_DIR
export RESET

# --- Bootstrap Logging ---

# shellcheck disable=SC1091
source "$SCRIPTS_DIR/_logging.sh"

# --- Functions ---

wait_for_env_file() {
  until [ -s "$ENV_FILE_PATH" ]; do sleep 2; done
  debug "Configuration saved."
}

launch_wikibase() {
  pushd "$DEPLOY_DIR" >/dev/null || return 1

  local compose_opts=()
  local compose_up_opts=(-d)

  if [ -f "docker-compose.local.yml" ]; then
    compose_opts+=(-f docker-compose.yml -f docker-compose.local.yml)
  fi

  if ! $DEBUG ; then
    compose_up_opts+=(--quiet-pull);
  fi

  if $RESET; then
    status "Removing config/LocalSettings.php (RESET=true)"
    run "rm -f config/LocalSettings.php"

    status "Taking down any existing wbs-deploy services and data (RESET=true)"
    run "docker compose ${compose_opts[*]} down --volumes"
  fi

  status "Waiting for services to start. Generally takes 2–6 minutes..."

  run "docker compose ${compose_opts[*]} up ${compose_up_opts[*]}"

  popd >/dev/null || return 1
}

# NOTE: final_message intentionally uses echo+tee for a clean human banner on stdout.
# The block is also appended to the log via tee, but WITHOUT timestamps/levels.
final_message() {
  {
    echo
    echo "✅ Setup is Complete!"
    echo
    if [[ -f "$ENV_FILE_PATH" ]]; then
      # shellcheck disable=SC1090
      source "$ENV_FILE_PATH"

      if [[ -n "${WIKIBASE_PUBLIC_HOST:-}" ]]; then
        echo "Your Wikibase Suite services can be found at:"
        echo
        echo "MediaWiki/Wikibase:"
        echo "https://$WIKIBASE_PUBLIC_HOST"
        echo
        echo "Query Service:"
        echo "https://${WDQS_PUBLIC_HOST:-query.$WIKIBASE_PUBLIC_HOST}"
        echo
        echo "QuickStatements:"
        echo "https://$WIKIBASE_PUBLIC_HOST/tools/quickstatements"
        echo
      else
        echo "⚠️ Could not determine WIKIBASE_PUBLIC_HOST from .env"
      fi

      echo
      echo "The following configuration was saved during setup."
      echo "Please save these credentials and settings securely:"
      echo
      sed 's/^/  /' "$ENV_FILE_PATH"
      echo
    else
      echo "⚠️ .env file not found at $ENV_FILE_PATH"
      echo
    fi
  } | tee -a "$LOG_PATH"
}

# --- Execution ---

wait_for_env_file
launch_wikibase
final_message
