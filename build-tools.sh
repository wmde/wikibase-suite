#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

BUILD_TOOLS_IMAGE=${WBS_BUILD_TOOLS_IMAGE:-wbs-build-tools:latest}
BUILD_ARGS=(
  --load
  --tag "$BUILD_TOOLS_IMAGE"
)

if [[ "${WBS_BUILD_TOOLS_NO_CACHE:-false}" == true ]]; then
  BUILD_ARGS+=(--no-cache --pull)
fi

if [[ -n "${BUILD_CACHE_REGISTRY:-}" ]]; then
  CACHE_REGISTRY=${BUILD_CACHE_REGISTRY%/}
  CACHE_SCOPE=${BUILD_CACHE_SCOPE:-$(docker info --format '{{.OSType}}-{{.Architecture}}')}
  CACHE_SCOPE=${CACHE_SCOPE//\//-}
  CACHE_SCOPE=${CACHE_SCOPE//,/_}
  CACHE_SCOPE=${CACHE_SCOPE//aarch64/arm64}
  CACHE_SCOPE=${CACHE_SCOPE//x86_64/amd64}
  CACHE_REF="${CACHE_REGISTRY}/build-tools:buildcache-${CACHE_SCOPE}"
  LEGACY_CACHE_REF="${CACHE_REGISTRY}/build-tools:buildcache"

  BUILD_TOOLS_BUILDER="wbs-build-tools-builder"
  if ! docker buildx inspect "$BUILD_TOOLS_BUILDER" >/dev/null 2>&1; then
    docker buildx create \
      --name "$BUILD_TOOLS_BUILDER" \
      --driver docker-container >/dev/null
  fi
  docker buildx inspect "$BUILD_TOOLS_BUILDER" --bootstrap >/dev/null

  BUILD_ARGS+=(--builder "$BUILD_TOOLS_BUILDER")

  if [[ "${WBS_BUILD_TOOLS_NO_CACHE:-false}" != true ]]; then
    # Read the former unscoped cache while platform-specific caches populate.
    # New cache records are written only to the platform-specific reference.
    BUILD_ARGS+=(
      --cache-from "type=registry,ref=${CACHE_REF}"
      --cache-from "type=registry,ref=${LEGACY_CACHE_REF}"
    )
  fi

  if [[ "${BUILD_CACHE_PUSH:-false}" == true ]]; then
    BUILD_ARGS+=(
      --cache-to "type=registry,ref=${CACHE_REF},mode=max,ignore-error=true"
    )
  fi
fi

exec docker buildx build "${BUILD_ARGS[@]}" .
