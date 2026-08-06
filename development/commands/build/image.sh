#!/usr/bin/env bash

set -euo pipefail

# === Script setup

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEVELOPMENT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
REPOSITORY_ROOT=$(cd "$DEVELOPMENT_ROOT/.." && pwd)

if [ "$#" -lt 1 ]; then
	echo "Usage: $0 <image> [--dry-run] [--publish] [docker buildx build arguments...]"
	exit 1
fi

IMAGE_PROJECT=$1

# Change to the directory for the specified image project
cd "$REPOSITORY_ROOT/docker-images/$IMAGE_PROJECT" || {
	echo "Failed to change directory to docker-images/$IMAGE_PROJECT"
	exit 1
}

# Remove the first argument, leaving the rest for docker buildx build
shift

DRY_RUN=false
PUBLISH=false
BUILD_ARGS=()
TAGS=()
BUILD_ENV_FILE="build.env"
DISALLOWED_ARGS=(
	"--firstRelease=true"
)

for arg in "$@"; do
	if [[ $arg == "--dry-run" || $arg == "--dryRun=true" ]]; then
		DRY_RUN=true
	elif [[ $arg == "--no-cache" ]]; then
		BUILD_ARGS+=("$arg")
	elif [[ $arg == "--publish" ]]; then
		PUBLISH=true
	elif [[ " ${DISALLOWED_ARGS[*]} " =~ $arg ]]; then
		continue
	else
		BUILD_ARGS+=("$arg")
	fi
done

# === Setup tags

IMAGE_VERSION=$(jq -r '.version' package.json)

if [ "$PUBLISH" = true ] && [[ ! "$IMAGE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	echo "Official image publication requires a stable MAJOR.MINOR.PATCH version; received $IMAGE_VERSION."
	# Extend this validation when prerelease publication is intentionally supported.
	exit 1
fi

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

if [ "$PUBLISH" = true ] && [[ "${GITHUB_REF:-}" == refs/tags/* ]]; then
	RELEASE_TAG=${GITHUB_REF#refs/tags/}
	EXPECTED_RELEASE_TAG="${IMAGE_NAME}@${IMAGE_VERSION}"
	if [ "$RELEASE_TAG" != "$EXPECTED_RELEASE_TAG" ]; then
		echo "Release tag $RELEASE_TAG does not match package version $EXPECTED_RELEASE_TAG."
		exit 1
	fi
fi

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
elif [ "$IMAGE_NAME" = "wbs-tools" ]; then
	BUILD_ARGS+=("--build-arg" "WBS_TOOLS_VERSION=$IMAGE_VERSION")
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

# == Run build

RUN_BUILDX_ARGS=(
	--cache-name "$IMAGE_NAME"
	--builder-name wbs-application-builder
	--context .
)

if [ "$IMAGE_NAME" = "wbs-tools" ]; then
	# wbs-tools is a pnpm workspace package outside the development directory;
	# use the repository build context so both it and the frozen lockfile are available.
	RUN_BUILDX_ARGS=(
		--cache-name "$IMAGE_NAME"
		--builder-name wbs-application-builder
		--context "$REPOSITORY_ROOT"
	)
	BUILD_ARGS+=(--file "$REPOSITORY_ROOT/docker-images/wbs-tools/Dockerfile")
fi

if [ "$DRY_RUN" = true ]; then
	RUN_BUILDX_ARGS+=(--dry-run)
fi

exec "$SCRIPT_DIR/../../lib/buildx.sh" "${RUN_BUILDX_ARGS[@]}" -- "${BUILD_ARGS[@]}"
