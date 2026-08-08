#!/usr/bin/env bash

# Internal host boundary for the containerized WBS tools application.

run_wbs_tools_validation() {
  docker run --rm \
    -e WBS_VALIDATE_OPTIONS=true \
    "$WBS_TOOLS_IMAGE" \
    node dist/wbs.js "$@"
}

run_wbs_tools_command() {
  local tty_flags=()
  if [[ -t 0 && -t 1 ]]; then
    tty_flags=(-it)
  else
    tty_flags=(-i)
  fi
  prepare_wbs_tools_container_args
  exec docker run "${tty_flags[@]}" \
    "${WBS_TOOLS_CONTAINER_ARGS[@]}" \
    -v "$WBS_DIR:/app/wbs" \
    "$WBS_TOOLS_IMAGE" \
    node /app/dist/wbs.js "$@"
}

prepare_install_runtime() {
  local docker_was_missing=false
  if ! command -v docker >/dev/null 2>&1; then
    docker_was_missing=true
  fi

  # shellcheck disable=SC1091
  source "$SCRIPTS_DIR/install-docker.sh"
  if [[ "$SKIP_DEPENDENCY_INSTALLS" != true ]]; then
    install_docker
  fi
  if [[ "${WBS_SKIP_ARCH_CHECK:-false}" != true ]]; then
    confirm_arch
  fi
  confirm_docker_version
  confirm_docker_compose_version
  confirm_docker_running
  if [[ "$docker_was_missing" == true ]]; then
    status "✅ Docker installed"
  fi
}

prepare_source_tools_image() {
  status "🕐 Building the WBS tools image from the selected source checkout..." "tools_build_started"
  if ! run_args "$WBS_DIR/development/wbs-dev" build wbs-tools; then
    status "⛔️ The WBS tools image build failed. Review $WBS_LOG_PATH or rerun with --debug." "tools_build_failed"
    exit 1
  fi
  status "✅ The source checkout's WBS tools image is ready." "tools_build_ready"

  export WBS_TOOLS_IMAGE="wikibase/wbs-tools:latest"
  export WBS_TOOLS_SKIP_PULL=true
  export WBS_BUILD_IMAGES=true
  export WBS_LOCAL_IMAGES=true
}

run_configurator() {
  local command="$1"
  shift
  local request_args=( "$@" )
  local configure_args=()
  local cli=true
  local show_help=false
  local argument

  for argument in "${request_args[@]}"; do
    case "$argument" in
      --web)
        cli=false
        configure_args+=( "$argument" )
        ;;
      --local)
        export LOCALHOST=true
        configure_args+=( "$argument" )
        ;;
      --debug)
        export DEBUG=true
        configure_args+=( "$argument" )
        ;;
      --from-source)
        ;;
      -h|--help)
        show_help=true
        configure_args+=( "$argument" )
        ;;
      *)
        configure_args+=( "$argument" )
        ;;
    esac
  done

  if [[ "$show_help" == true ]]; then
    exec docker run --rm "$WBS_TOOLS_IMAGE" \
      node dist/wbs.js "$command" "${request_args[@]}"
  fi

  run_wbs_tools_validation "$command" "${request_args[@]}"

  if [[ "$command" == configure ]]; then
    export CONFIGURE_ONLY=true
  fi

  if [[ "$cli" == true ]]; then
    run_wbs_tools_command "$command" "${request_args[@]}"
  fi

  exec bash "$SCRIPTS_DIR/run-web-installer.sh" "${configure_args[@]}"
}

prepare_install() {
  local from_source=false
  local argument
  for argument in "$@"; do
    if [[ "$argument" == --from-source ]]; then
      from_source=true
    fi
  done

  prepare_install_runtime
  if [[ "$from_source" == true ]]; then
    prepare_source_tools_image
  fi
}

run_install() {
  run_configurator install "$@"
}

run_configure() {
  run_configurator configure "$@"
}

main() {
  local command="${1:-}"
  SCRIPTS_DIR="${SCRIPTS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
  WBS_DIR="${WBS_DIR:-$(cd "$SCRIPTS_DIR/.." && pwd)}"
  export WBS_DIR SCRIPTS_DIR
  if [[ -f "$WBS_DIR/local.env" ]]; then
    set -a
    # local.env is an operator-owned, shell-compatible override file.
    # shellcheck disable=SC1091
    source "$WBS_DIR/local.env"
    set +a
  fi
  export WBS_STATE_DIR="${WBS_STATE_DIR:-$WBS_DIR/.wbs}"
  export ENV_FILE_PATH="${ENV_FILE_PATH:-$WBS_DIR/.env}"
  export WBS_LOG_PATH="${WBS_LOG_PATH:-$WBS_STATE_DIR/wbs.log}"
  export INSTALLATION_LOG_PATH="${INSTALLATION_LOG_PATH:-$WBS_STATE_DIR/installation.log}"
  export DEBUG="${DEBUG:-false}"
  export INSTALLER_DEV=false
  export INSTALLER_DEV_MOCK=false
  export LOCALHOST=false
  export CONFIGURE_ONLY=false
  export WBS_BUILD_IMAGES=false
  SKIP_DEPENDENCY_INSTALLS="${WBS_SKIP_DEPENDENCY_INSTALLS:-false}"

  # shellcheck disable=SC1091
  source "$SCRIPTS_DIR/_logging.sh"
  # shellcheck disable=SC1091
  source "$SCRIPTS_DIR/_wbs-tools-runtime.sh"

  if [[ "$command" == install ]]; then
    prepare_install "${@:2}"
  fi
  ensure_wbs_tools_image " For an unpublished source checkout, rerun wbs install with --from-source."

  case "$command" in
    install)
      shift
      run_install "$@"
      ;;
    configure)
      shift
      run_configure "$@"
      ;;
    *)
      # All other verbs are implemented entirely by the tools application.
      # This path also renders application help when no verb was supplied.
      run_wbs_tools_command "$@"
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  set -euo pipefail
  main "$@"
fi
