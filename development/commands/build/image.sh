#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
DEVELOPMENT_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)

if [ "$#" -lt 1 ]; then
	echo "Usage: $0 <image> [--dry-run] [--publish] [docker buildx bake arguments]"
	exit 1
fi

IMAGE_PROJECT=$1
IMAGE_ROOT="$DEVELOPMENT_ROOT/images/$IMAGE_PROJECT"
cd "$IMAGE_ROOT"
shift

DRY_RUN=false
PUBLISH=false
PUSH=false
NO_CACHE=false
PLATFORMS=""
BAKE_ARGS=()

while [[ $# -gt 0 ]]; do
	case "$1" in
		--dry-run|--dryRun=true)
			DRY_RUN=true
			shift
			;;
		--publish)
			PUBLISH=true
			shift
			;;
		--push)
			PUSH=true
			shift
			;;
		--load)
			# The default image target already uses the Docker output.
			shift
			;;
		--no-cache)
			NO_CACHE=true
			BAKE_ARGS+=("$1")
			shift
			;;
		--platform)
			[[ -n "${2:-}" ]] || { echo "--platform requires a value." >&2; exit 1; }
			PLATFORMS=$2
			shift 2
			;;
		--platform=*)
			PLATFORMS=${1#--platform=}
			shift
			;;
		--firstRelease=true)
			shift
			;;
		*)
			BAKE_ARGS+=("$1")
			shift
			;;
	esac
done

VARIABLES=$(docker buildx bake --list=type=variables,format=json)
IMAGE_NAME=$(jq -r '.[] | select(.name == "IMAGE_NAME") | .value' <<<"$VARIABLES")
IMAGE_VERSION=$(jq -r '.[] | select(.name == "IMAGE_VERSION") | .value' <<<"$VARIABLES")

if [[ "$IMAGE_NAME" != "$IMAGE_PROJECT" ]]; then
	echo "Image directory $IMAGE_PROJECT does not match manifest name $IMAGE_NAME." >&2
	exit 1
fi

TARGET=$IMAGE_NAME
IMAGE_REPOSITORY="wikibase/$IMAGE_NAME"
TAGS="latest"

if [ "$PUBLISH" = true ]; then
	[[ "$IMAGE_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-z][a-z0-9-]*\.(0|[1-9][0-9]*))?$ ]] || {
		echo "Official image publication requires a semantic release version; received $IMAGE_VERSION." >&2
		exit 1
	}
	TARGET="${IMAGE_NAME}-release"
	BAKE_ARGS+=(--push)
	if [[ "${GITHUB_REF:-}" == refs/tags/* ]]; then
		RELEASE_TAG=${GITHUB_REF#refs/tags/}
		EXPECTED_RELEASE_TAG="${IMAGE_NAME}@${IMAGE_VERSION}"
		if [ "$RELEASE_TAG" != "$EXPECTED_RELEASE_TAG" ]; then
			echo "Release tag $RELEASE_TAG does not match manifest version $EXPECTED_RELEASE_TAG." >&2
			exit 1
		fi
	fi
elif [ "${GITHUB_ACTIONS:-}" = true ]; then
	IMAGE_REPOSITORY="ghcr.io/${GITHUB_REPOSITORY_OWNER}/wikibase/${IMAGE_NAME}"
	TAGS="dev-${GITHUB_RUN_ID}"
fi

if [ "$PUSH" = true ]; then
	BAKE_ARGS+=(--set "${TARGET}.output=type=registry")
fi

if [ -n "$PLATFORMS" ]; then
	if [[ "$PLATFORMS" == *,* && "$PUSH" = false && "$PUBLISH" = false ]]; then
		echo "Multi-platform builds require --push or --publish; Docker cannot load a multi-platform image." >&2
		exit 1
	fi
	IFS=',' read -r -a PLATFORM_LIST <<<"$PLATFORMS"
	BAKE_ARGS+=(--set "${TARGET}.platform=${PLATFORM_LIST[0]}")
	for PLATFORM in "${PLATFORM_LIST[@]:1}"; do
		BAKE_ARGS+=(--set "${TARGET}.platform+=${PLATFORM}")
	done
fi

BUILDER_NAME=wbs-application-builder
if [ -n "${BUILD_CACHE_REGISTRY:-}" ]; then
	CACHE_REGISTRY=${BUILD_CACHE_REGISTRY%/}
	CACHE_SCOPE=${BUILD_CACHE_SCOPE:-${PLATFORMS:-$(docker info --format '{{.OSType}}-{{.Architecture}}')}}
	CACHE_SCOPE=${CACHE_SCOPE//\//-}
	CACHE_SCOPE=${CACHE_SCOPE//,/_}
	CACHE_SCOPE=${CACHE_SCOPE//aarch64/arm64}
	CACHE_SCOPE=${CACHE_SCOPE//x86_64/amd64}
	CACHE_REF="${CACHE_REGISTRY}/${IMAGE_NAME}:buildcache-${CACHE_SCOPE}"
	LEGACY_CACHE_REF="${CACHE_REGISTRY}/${IMAGE_NAME}:buildcache"

	BAKE_ARGS+=(--builder "$BUILDER_NAME")
	if [ "$NO_CACHE" = false ]; then
		BAKE_ARGS+=(
			--set "${TARGET}.cache-from=type=registry,ref=${CACHE_REF}"
			--set "${TARGET}.cache-from+=type=registry,ref=${LEGACY_CACHE_REF}"
		)
	fi
	if [ "${BUILD_CACHE_PUSH:-false}" = true ]; then
		BAKE_ARGS+=(
			--set "${TARGET}.cache-to=type=registry,ref=${CACHE_REF},mode=max,ignore-error=true"
		)
	fi

	if [ "$DRY_RUN" = false ]; then
		if ! docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1; then
			if ! create_output=$(docker buildx create --name "$BUILDER_NAME" --driver docker-container 2>&1); then
				docker buildx inspect "$BUILDER_NAME" >/dev/null 2>&1 || {
					printf '%s\n' "$create_output" >&2
					exit 1
				}
			fi
		fi
		docker buildx inspect "$BUILDER_NAME" --bootstrap >/dev/null
	fi
fi

if [ "$IMAGE_NAME" = "wbs-tools" ]; then
	BAKE_ARGS+=(--allow "fs.read=$DEVELOPMENT_ROOT")
fi

if [ "$DRY_RUN" = true ]; then
	BAKE_ARGS+=(--print)
fi

exec env \
	IMAGE_REPOSITORY="$IMAGE_REPOSITORY" \
	TAGS="$TAGS" \
	docker buildx bake "${BAKE_ARGS[@]}" "$TARGET"
