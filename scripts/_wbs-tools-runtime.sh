#!/usr/bin/env bash

set -euo pipefail

# shellcheck disable=SC1091
source "$SCRIPTS_DIR/_logging.sh"
# shellcheck disable=SC1091
source "$SCRIPTS_DIR/_versions.sh"

# Shared host-side arguments for WBS tools containers. Callers keep lifecycle,
# network, and published-port options explicit at each security boundary.
prepare_wbs_tools_container_args() {
  WBS_TOOLS_CONTAINER_ARGS=(--rm)

  local variable_name
  local variable_names="COMPOSE_PROJECT_NAME BUILD_CACHE_REGISTRY GITHUB_ACTIONS WBS_DEV_IMAGE ${WBS_TOOLS_ENV_PASSTHROUGH:-}"
  for variable_name in $variable_names; do
    if [[ -v "$variable_name" ]]; then
      WBS_TOOLS_CONTAINER_ARGS+=(-e "$variable_name")
    fi
  done

  WBS_TOOLS_CONTAINER_ARGS+=(
    -e "WBS_DIR=$WBS_DIR"
    -e "ENV_FILE_PATH=$ENV_FILE_PATH"
    -e "WBS_LOG_PATH=$WBS_LOG_PATH"
    -e "INSTALLATION_LOG_PATH=$INSTALLATION_LOG_PATH"
    -v /var/run/docker.sock:/var/run/docker.sock
    -v "$WBS_DIR:$WBS_DIR"
    -w "$WBS_DIR"
  )
}

require_wbs_tools_image() {
  if ! docker image inspect "$WBS_TOOLS_IMAGE" >/dev/null 2>&1; then
    status "⛔️ Required local image $WBS_TOOLS_IMAGE was not found"
    return 1
  fi
}

update_wbs_tools_image() {
  local failure_hint="${1:-}"
  if [[ "${WBS_TOOLS_SKIP_PULL:-false}" == true ]]; then
    require_wbs_tools_image
    return
  fi
  if ! run_args docker pull "$WBS_TOOLS_IMAGE"; then
    status "⛔️ Could not pull $WBS_TOOLS_IMAGE.$failure_hint" "tools_pull_failed"
    return 1
  fi
}
