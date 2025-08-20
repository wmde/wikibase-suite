#!/usr/bin/env bash
set -euo pipefail

# --- Expected Variables ---

export SCRIPTS_DIR

# --- Bootstrap Logging ---

# shellcheck disable=SC1091
source "$SCRIPTS_DIR/_logging.sh"

# --- Main Script ---

debug "Checking for Docker..."

if command -v docker >/dev/null 2>&1; then
  exit 0
fi

debug "Installing Docker..."

if command -v apt-get >/dev/null 2>&1; then
  # Debian/Ubuntu: install Docker from official Docker APT repo for consistent versioning

  # Detect OS and codename
  OS_ID="$(. /etc/os-release 2>/dev/null; echo "${ID:-debian}")"
  CODENAME="$(. /etc/os-release 2>/dev/null; echo "${VERSION_CODENAME:-}")"
  if [ -z "$CODENAME" ] && command -v lsb_release >/dev/null 2>&1; then
    CODENAME="$(lsb_release -cs 2>/dev/null || true)"
  fi
  if [ -z "$CODENAME" ]; then
    echo "❌ Could not determine distro codename" >&2
    exit 1
  fi

  run "echo 'Using Docker APT repo for $OS_ID ($CODENAME)'"
  run "apt-get update -y"
  run "apt-get install -y --no-install-recommends ca-certificates curl gnupg"
  run "install -m 0755 -d /etc/apt/keyrings"
  run "curl -fsSL https://download.docker.com/linux/$OS_ID/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg"
  run "apt-get remove -y docker.io docker-compose docker-compose-v2 2>/dev/null || true"
  run "echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS_ID $CODENAME stable\" | tee /etc/apt/sources.list.d/docker.list >/dev/null"
  run "apt-get update -y"
  run "apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin"
elif command -v dnf >/dev/null 2>&1; then
  # Distinguish Fedora vs RHEL-family (CentOS Stream, RHEL, Rocky, Alma)
  OS_ID="$(. /etc/os-release 2>/dev/null; echo "${ID:-}")"

  if [ "$OS_ID" = "fedora" ]; then
    # Fedora: use Fedora-maintained Moby packages
    run "dnf -y install moby-engine moby-cli docker-compose-plugin docker-buildx-plugin"
  else
    # RHEL-family (CentOS Stream / RHEL / Rocky / Alma): use Docker's official repo
    run "dnf -y install dnf-plugins-core"
    run "dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo"
    run "dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || \
         (echo '❌ Docker CE packages not available for this release yet.' >&2; exit 1)"
  fi
else
  status "⚠️ Unsupported package manager. Please install Docker manually."
  exit 1
fi

debug "Enabling and starting Docker..."
run "systemctl enable --now docker"
status "Docker installation complete."
run "docker --version" || true
run "docker compose version" || true
