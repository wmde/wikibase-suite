#!/usr/bin/env bash
set -euo pipefail

echo
echo "Wikibase Suite Deploy Setup"
echo
echo "→ Installs Git if not already installed"
echo "→ Checks-out the wikibase-release-pipeline repository"
echo "→ Installs Docker if not already installed"
echo "→ Starts a Web-based setup tool where you can complete configuration"
echo "→ Launches Wikibase Suite, notifying when the services are available"
echo
echo "Let's get started!"
echo

# --- Parse CLI Arguments ---

for arg in "$@"; do
  case "$arg" in
    --dev)
      LOCALHOST=true
      SKIP_DEPENDENCY_INSTALLS=true
      ;;
    --reset)
      RESET=true
      ;;
    --skip-clone)
      SKIP_CLONE=true
      ;;
    --skip-deps)
      SKIP_DEPENDENCY_INSTALLS=true
      ;;
    --skip-launch)
      SKIP_LAUNCH=true
      ;;
    --debug)
      DEBUG=true
      ;;
    --local)
      LOCALHOST=true
      ;;
  esac
done

# When running within a repository assume it is wikibase-release-pipeline
# and use files in that repo
if [[ -d "$(dirname "${BASH_SOURCE[0]:-}")/../../.git" ]]; then
  SKIP_CLONE=true
  WBS_DIR=../../..
  echo "⚠️ Running inside repo (SKIP_CLONE=true, WBS_DIR=$WBS_DIR)"
fi

# --- Setup variables (including defaults) ---

REPO_URL="${REPO_URL:-https://github.com/wmde/wikibase-release-pipeline.git}"
# TODO: Change to default to latest deploy version tag once released
REPO_BRANCH="${REPO_BRANCH:-deploy-setup-script}"
SKIP_CLONE="${SKIP_CLONE:-false}"
WBS_DIR="${WBS_DIR:-$HOME/wbs}"

export DEBUG="${DEBUG:-false}"
export LOCALHOST="${LOCALHOST:-false}"
export SKIP_DEPENDENCY_INSTALLS="${SKIP_DEPENDENCY_INSTALLS:-false}"
export SKIP_LAUNCH="${SKIP_LAUNCH:-false}"
export RESET="${RESET:-false}"

export DEPLOY_DIR="${DEPLOY_DIR:-$WBS_DIR/wikibase-release-pipeline/deploy}"
export ENV_FILE_PATH="$DEPLOY_DIR/.env"
export SETUP_DIR="${SETUP_DIR:-$DEPLOY_DIR/setup}"
export SCRIPTS_DIR="$SETUP_DIR/scripts"

# --- Functions ---

install_git() {
  if command -v git >/dev/null 2>&1; then
    return
  fi

  echo "Installing Git..."

  if command -v apt-get >/dev/null 2>&1; then
    # Debian / Ubuntu
    apt-get update >/dev/null 2>&1 || true
    apt-get install -y git >/dev/null 2>&1
  elif command -v dnf >/dev/null 2>&1; then
    # Fedora / RHEL 8+ / Rocky / Alma
    dnf install -y git >/dev/null 2>&1
  elif command -v yum >/dev/null 2>&1; then
    # CentOS 7 / Amazon Linux 2 / older RHEL-family (yum-based)
    # - Legacy yum path; installs Git from the default repos.
    #   On older CentOS 7 this will be an older Git version, but usually fine.
    yum install -y git >/dev/null 2>&1
  else
    echo "⚠️ Unsupported package manager. Please install Git manually."
    exit 1
  fi
}

clone_repo() {
  echo "Cloning repository to $WBS_DIR..."
  mkdir -p "$WBS_DIR"
  pushd "$WBS_DIR" >/dev/null || return 1

  if [ ! -d wikibase-release-pipeline/.git ]; then
    git clone --branch "$REPO_BRANCH" --single-branch "$REPO_URL" --depth 1 >/dev/null 2>&1
  else
    echo "⚠️ An existing git repository found at $WBS_DIR/wikibase-release-pipeline, using what is there ..."
  fi

  popd >/dev/null || return 1
}

# --- Execution ---

if ! $SKIP_DEPENDENCY_INSTALLS; then
  install_git
fi

if ! $SKIP_CLONE; then
  clone_repo
fi

if $RESET; then
  echo
  if [[ -f "$ENV_FILE_PATH" ]]; then
    printf "Delete the current configuration found in .env? [y/N]: "
    read -n 1 -r reset_config
    echo
    case "${reset_config:-n}" in
      y|Y)
        rm -f "$ENV_FILE_PATH"
        ;;
    esac
    echo 
  fi

  printf "⛔️ Delete any existing wbs-deploy services AND data? [y/N]: "
  read -n 1 -r reset_data
  echo
  case "${reset_data:-n}" in
    y|Y)
      ;;
    *)
      export RESET=false
      ;;
  esac
  echo
fi

exec bash "$SCRIPTS_DIR/setup.sh" "$@"
