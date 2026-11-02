#!/usr/bin/env bash
set -e

if [[ -n "${DOCKERHUB_TOKEN:-}" ]]; then
  printf '%s' "$DOCKERHUB_TOKEN" |
    docker login --username wmdetravisbot --password-stdin >/dev/null
fi

GHCR_TOKEN=${WBS_GHCR_TOKEN:-${GITHUB_TOKEN:-${GH_TOKEN:-}}}
if [[ -n "$GHCR_TOKEN" && -n "${GITHUB_REPOSITORY_OWNER:-}" ]]; then
  printf '%s' "$GHCR_TOKEN" |
    docker login ghcr.io --username "$GITHUB_REPOSITORY_OWNER" --password-stdin >/dev/null
fi

# Keep the mounted workspace dependencies synchronized with the exact lockfile.
if [ -f "pnpm-lock.yaml" ]; then
  lockfile_hash=$(sha256sum pnpm-lock.yaml | cut -d ' ' -f 1)
  lockfile_marker="node_modules/.wbs-build-tools-lockfile"
  installed_hash=$(cat "$lockfile_marker" 2>/dev/null || true)

  if [[ "$installed_hash" != "$lockfile_hash" ]]; then
    echo "Installing workspace dependencies from the frozen lockfile"
    pnpm install --frozen-lockfile
    printf '%s\n' "$lockfile_hash" > "$lockfile_marker"
  fi
elif ! [ -f "pnpm-lock.yaml" ]; then
  echo "pnpm-lock.yaml does not exist, running 'pnpm install'"
  pnpm install
fi

# Execute the command passed to the container
exec bash "$@"
