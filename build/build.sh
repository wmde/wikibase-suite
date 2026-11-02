#!/usr/bin/env bash

set -euo pipefail

# === Script setup

# Change to the directory where the script is located
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ "$#" -lt 1 ]; then
	echo "Usage: $0 <directory> [--dry-run] [--publish] [docker buildx build arguments...]"
	exit 1
fi

# Change to the directory for the specified project
cd "$1" || {
	echo "Failed to change directory to $1"
	exit 1
}

# Remove the first argument, leaving the rest for docker buildx build
shift

DRY_RUN=false
PUBLISH=false
NO_CACHE=false
TARGET_PLATFORMS=""
BUILD_ARGS=()
TAGS=()
BUILD_ENV_FILE="build.env"
DISALLOWED_ARGS=(
	"--firstRelease=true"
)

PREVIOUS_ARG=""
for arg in "$@"; do
	if [[ "$PREVIOUS_ARG" == "--platform" ]]; then
		TARGET_PLATFORMS="$arg"
	elif [[ "$arg" == --platform=* ]]; then
		TARGET_PLATFORMS=${arg#--platform=}
	fi

	if [[ $arg == "--dry-run" || $arg == "--dryRun=true" ]]; then
		DRY_RUN=true
	elif [[ $arg == "--no-cache" ]]; then
		NO_CACHE=true
		BUILD_ARGS+=("$arg")
	elif [[ $arg == "--publish" ]]; then
		PUBLISH=true
	elif [[ " ${DISALLOWED_ARGS[*]} " =~ $arg ]]; then
		continue
	else
		BUILD_ARGS+=("$arg")
	fi
	PREVIOUS_ARG="$arg"
done

# === Setup tags

IMAGE_VERSION=$(jq -r '.version' package.json)

# publish to Dockerhub
if [ "$PUBLISH" = true ]; then
	IMAGE_VERSION_MAJOR=$(echo "$IMAGE_VERSION" | cut -d '.' -f 1)
	IMAGE_VERSION_MINOR=$(echo "$IMAGE_VERSION" | cut -d '.' -f 1,2)
	TAGS+=(
		"${IMAGE_VERSION}"
		"${IMAGE_VERSION_MAJOR}"
		"${IMAGE_VERSION_MINOR}"
	)
	# get image specific tags
	if [ -f "$BUILD_ENV_FILE" ]; then
		# shellcheck disable=SC1090
		source "$BUILD_ENV_FILE"
		eval "$(declare -p IMAGE_TAGS 2>/dev/null)"
		TAGS+=(
			"${IMAGE_TAGS[@]}"
		)
	fi
	BUILD_ARGS+=("--push")
# build/test in CI
elif [ "${GITHUB_ACTIONS:-}" = true ]; then
	TAGS+=(
		"dev-${GITHUB_RUN_ID}"
	)
# local build
else
	BUILD_ARGS+=("--load")
	# When not tagging anything but the image name the "latest" tag is by default applied,
	# making that explicit here:
	TAGS+=(
		"latest"
	)
fi

IMAGE_NAME=$(jq -r '.name' package.json)

# publish to Dockerhub
if [ "$PUBLISH" = true ]; then
	IMAGE_REGISTRY=""
	IMAGE_NAMESPACE=wikibase

# build/test in CI
elif [ "${GITHUB_ACTIONS:-}" = true ]; then
	IMAGE_REGISTRY=ghcr.io
	IMAGE_NAMESPACE="${GITHUB_REPOSITORY_OWNER}/wikibase"

# local build
else
	IMAGE_REGISTRY=""
	IMAGE_NAMESPACE=wikibase
fi

if [ -n "$IMAGE_REGISTRY" ]; then
	IMAGE_URL="${IMAGE_REGISTRY}/${IMAGE_NAMESPACE}/${IMAGE_NAME}"
else
	IMAGE_URL="${IMAGE_NAMESPACE}/${IMAGE_NAME}"
fi

for TAG in "${TAGS[@]}"; do
	BUILD_ARGS+=("--tag" "${IMAGE_URL}:${TAG}")
done

# === Wikibase Suite version metadata build args
if [ "$IMAGE_NAME" = "wikibase" ]; then
	BUILD_ARGS+=("--build-arg" "WIKIBASE_IMAGE_VERSION=$IMAGE_VERSION")
	BUILD_TOOLS_GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || true)"
	if [ -n "$BUILD_TOOLS_GIT_SHA" ]; then
		BUILD_ARGS+=("--build-arg" "BUILD_TOOLS_GIT_SHA=$BUILD_TOOLS_GIT_SHA")
	fi
fi

# === Transform vars in build.env to build args

if [ -f "$BUILD_ENV_FILE" ]; then
	while IFS='=' read -r key value; do
		# skip if the line is empty or the key is IMAGE_TAGS
		[ -z "$key" ] || [[ "$key" == IMAGE_TAGS ]] && continue

		if [ -n "$value" ]; then
			BUILD_ARGS+=("--build-arg" "$key=$value")
		fi
	done < <(grep -E '^[A-Z_]+=.*' "$BUILD_ENV_FILE")
fi

# === Import and export BuildKit cache
#
# CI enables the shared registry cache with the environment variables below.
# Local builds use BuildKit's local cache automatically, but developers can opt
# into the registry cache after authenticating Docker with a package token.

if [ -n "${BUILD_CACHE_REGISTRY:-}" ]; then
	CACHE_REGISTRY=${BUILD_CACHE_REGISTRY%/}
	CACHE_REPOSITORY="${CACHE_REGISTRY}/${IMAGE_NAME}"
	CACHE_SCOPE=${BUILD_CACHE_SCOPE:-${TARGET_PLATFORMS:-$(docker info --format '{{.OSType}}-{{.Architecture}}')}}
	CACHE_SCOPE=${CACHE_SCOPE//\//-}
	CACHE_SCOPE=${CACHE_SCOPE//,/_}
	CACHE_SCOPE=${CACHE_SCOPE//aarch64/arm64}
	CACHE_SCOPE=${CACHE_SCOPE//x86_64/amd64}
	CACHE_REF="${CACHE_REPOSITORY}:buildcache-${CACHE_SCOPE}"
	LEGACY_CACHE_REF="${CACHE_REPOSITORY}:buildcache"
	APPLICATION_BUILDER="wbs-application-builder"

	BUILD_ARGS+=("--builder" "$APPLICATION_BUILDER")

	if [ "$NO_CACHE" = false ]; then
		# Read the former unscoped cache while platform-specific caches populate.
		# New cache records are written only to the platform-specific reference.
		BUILD_ARGS+=(
			"--cache-from" "type=registry,ref=${CACHE_REF}"
			"--cache-from" "type=registry,ref=${LEGACY_CACHE_REF}"
		)
	fi

	if [ "${BUILD_CACHE_PUSH:-false}" = true ]; then
		BUILD_ARGS+=(
			"--cache-to"
			"type=registry,ref=${CACHE_REF},mode=max,ignore-error=true"
		)
	fi
fi

# == Run build

BUILD_COMMAND=(docker buildx build "${BUILD_ARGS[@]}" .)

if [ "$DRY_RUN" = true ]; then
	echo "Dry-run. This is the build command which would run:"
	echo
	printf '%q ' "${BUILD_COMMAND[@]}"
	echo
	echo
else
	# Registry cache export requires a BuildKit builder rather than Docker's
	# default builder. Keep this here so direct local and containerized CI builds
	# use the same behavior whenever a registry cache is configured.
	if [ -n "${BUILD_CACHE_REGISTRY:-}" ]; then
		if ! docker buildx inspect "$APPLICATION_BUILDER" >/dev/null 2>&1; then
			docker buildx create \
				--name "$APPLICATION_BUILDER" \
				--driver docker-container >/dev/null
		fi
		docker buildx inspect "$APPLICATION_BUILDER" --bootstrap >/dev/null
	fi

	exec "${BUILD_COMMAND[@]}"
fi
