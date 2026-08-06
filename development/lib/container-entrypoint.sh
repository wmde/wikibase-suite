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

# Keep the container-owned workspace dependencies synchronized with the project
# configuration and package-manager version.
if [ -f "pnpm-lock.yaml" ]; then
  dependency_state_hash=$(
    {
      sha256sum package.json pnpm-lock.yaml pnpm-workspace.yaml
      pnpm --version
    } | sha256sum | cut -d ' ' -f 1
  )
  dependency_state_marker="node_modules/.wbs-dev-dependencies"
  installed_hash=$(cat "$dependency_state_marker" 2>/dev/null || true)

  if [[ "$installed_hash" != "$dependency_state_hash" ]] ||
    [[ ! -x node_modules/.bin/tsx ]] ||
    [[ ! -x ../docker-images/wbs-tools/node_modules/.bin/vite ]]; then
    echo "Installing workspace dependencies from the frozen lockfile"
    pnpm install --frozen-lockfile
    printf '%s\n' "$dependency_state_hash" > "$dependency_state_marker"
  fi
else
  echo "pnpm-lock.yaml does not exist, running 'pnpm install'"
  pnpm install
fi

# Execute the command passed to the development container.
exec bash "$@"
