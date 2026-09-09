#!/usr/bin/env bash

set -euo pipefail

readonly INSTALLER_REPOSITORY="wmde/wikibase-suite-install"
readonly PAGES_ROOT="https://wmde.github.io/wikibase-suite-install"
readonly STATE_DIR="${RUNNER_TEMP:-/tmp}/wikibase-suite-installer"
readonly PR_PAYLOAD_PATH="$STATE_DIR/pr-dispatch.json"
readonly PR_CLEANUP_PAYLOAD_PATH="$STATE_DIR/pr-cleanup-dispatch.json"
readonly RELEASE_PAYLOAD_PATH="$STATE_DIR/release-dispatch.json"
declare -a IMAGES=()

load_images() {
  local source_commit="${1:-}"
  if [[ -n "$source_commit" ]]; then
    # This publisher runs trusted default-branch code. Read the PR's image
    # directories as Git data instead of running its wbs-dev command, so the
    # installation manifest matches the images CI built for that commit.
    git fetch --no-tags origin "$source_commit" >/dev/null
    mapfile -t IMAGES < <(
      git ls-tree -d --name-only "$source_commit:development/images" |
        grep -Ev '^(_|node_modules$)' |
        sort
    )
  else
    mapfile -t IMAGES < <(cd development && ./wbs-dev build --list=json | jq -r '.[]')
  fi
  ((${#IMAGES[@]} > 0)) || {
    echo "Could not discover any Suite images." >&2
    exit 1
  }
}

validate_origin_repository() {
  case "${ORIGIN_REPOSITORY:-}" in
    wmde/wikibase-suite) ;;
    *)
      echo "Unexpected origin repository: ${ORIGIN_REPOSITORY:-unset}" >&2
      exit 1
      ;;
  esac
}

dispatch_payload() {
  local payload_path="$1"
  [[ -s "$payload_path" ]] || {
    echo "No installer publication payload found at $payload_path." >&2
    exit 1
  }
  gh api --method POST \
    "repos/$INSTALLER_REPOSITORY/dispatches" \
    --input "$payload_path"
}

wait_for_publication() {
  local url="$1"
  local expected="$2"
  local description="$3"
  local content

  echo "Waiting for $description at $url..."
  for _ in {1..60}; do
    if content="$(curl --location --connect-timeout 3 --max-time 5 --fail --silent --show-error "$url" 2>/dev/null)" &&
      grep -Fq "$expected" <<< "$content"; then
      echo "Published $description."
      return
    fi
    sleep 5
  done
  echo "Timed out waiting for $description at $url." >&2
  exit 1
}

prepare_pr() {
  validate_origin_repository
  [[ "${PR_NUMBER:-}" =~ ^[1-9][0-9]*$ ]] || {
    echo "Invalid PR number." >&2
    exit 1
  }
  [[ "${PR_HEAD_SHA:-}" =~ ^[0-9a-f]{40}$ ]] || {
    echo "Invalid PR head SHA." >&2
    exit 1
  }
  load_images "$PR_HEAD_SHA"

  mkdir -p "$STATE_DIR"
  rm -f "$PR_PAYLOAD_PATH"

  local short_sha="${PR_HEAD_SHA:0:12}"
  local tag="pr-${PR_NUMBER}-${short_sha}"
  local pull_request current_sha head_ref state
  pull_request="$(gh api "repos/$ORIGIN_REPOSITORY/pulls/$PR_NUMBER")"
  current_sha="$(jq -r '.head.sha' <<< "$pull_request")"
  head_ref="$(jq -r '.head.ref' <<< "$pull_request")"
  state="$(jq -r '.state' <<< "$pull_request")"
  if [[ "$state" != open ]]; then
    echo "Pull request $PR_NUMBER is no longer open; skipping installer publication."
    return
  fi
  local current=false
  if [[ "$current_sha" == "$PR_HEAD_SHA" ]]; then
    current=true
  fi
  git check-ref-format --branch "$head_ref" >/dev/null || {
    echo "Invalid PR head branch: $head_ref" >&2
    exit 1
  }

  local images_json='{}'
  local image_name image source_amd64 source_arm64
  local -a sources
  for image_name in "${IMAGES[@]}"; do
    image="ghcr.io/wmde/wikibase/$image_name"
    source_amd64="$image:$tag-amd64"
    source_arm64="$image:$tag-arm64"
    if ! docker buildx imagetools inspect "$source_amd64" >/dev/null 2>&1; then
      echo "No PR image found at $source_amd64; this successful run did not publish a PR set."
      return
    fi

    sources=("$source_amd64")
    if docker buildx imagetools inspect "$source_arm64" >/dev/null 2>&1; then
      sources+=("$source_arm64")
    fi
    docker buildx imagetools create --tag "$image:$tag" "${sources[@]}"
    if [[ "$current" == true ]]; then
      docker buildx imagetools create --tag "$image:pr-$PR_NUMBER" "$image:$tag"
    fi
    images_json="$(jq -c --arg name "$image_name" --arg image "$image:$tag" \
      '. + {($name): $image}' <<< "$images_json")"
  done

  # Coordinated image publication currently supports same-repository PRs.
  jq -n \
    --arg event_type publish-pr-installation \
    --arg origin_repository "$ORIGIN_REPOSITORY" \
    --arg source_repository "$ORIGIN_REPOSITORY" \
    --arg source_ref "$head_ref" \
    --argjson pr "$PR_NUMBER" \
    --arg commit "$PR_HEAD_SHA" \
    --argjson current "$current" \
    --argjson images "$images_json" \
    '{
      event_type: $event_type,
      client_payload: {
        schemaVersion: 1,
        originRepository: $origin_repository,
        sourceRepository: $source_repository,
        sourceRef: $source_ref,
        pr: $pr,
        commit: $commit,
        current: $current,
        images: $images
      }
    }' > "$PR_PAYLOAD_PATH"
}

cleanup_pr() {
  validate_origin_repository
  [[ "${PR_NUMBER:-}" =~ ^[1-9][0-9]*$ ]] || {
    echo "Invalid PR number." >&2
    exit 1
  }

  mkdir -p "$STATE_DIR"
  jq -n \
    --arg event_type cleanup-pr-installation \
    --arg origin_repository "$ORIGIN_REPOSITORY" \
    --arg source_repository "$ORIGIN_REPOSITORY" \
    --argjson pr "$PR_NUMBER" \
    '{
      event_type: $event_type,
      client_payload: {
        schemaVersion: 1,
        operation: "delete-pr",
        originRepository: $origin_repository,
        sourceRepository: $source_repository,
        pr: $pr
      }
    }' > "$PR_CLEANUP_PAYLOAD_PATH"
  dispatch_payload "$PR_CLEANUP_PAYLOAD_PATH"
}

dispatch_pr() {
  if [[ ! -s "$PR_PAYLOAD_PATH" ]]; then
    echo "No coordinated PR payload was produced; skipping installer publication."
    return
  fi
  dispatch_payload "$PR_PAYLOAD_PATH"

  local pr commit short_sha current
  pr="$(jq -r '.client_payload.pr' "$PR_PAYLOAD_PATH")"
  commit="$(jq -r '.client_payload.commit' "$PR_PAYLOAD_PATH")"
  current="$(jq -r '.client_payload.current' "$PR_PAYLOAD_PATH")"
  short_sha="${commit:0:12}"
  wait_for_publication \
    "$PAGES_ROOT/pr-$pr-$short_sha" "export WBS_REF='$commit'" \
    "immutable PR installer"
  wait_for_publication \
    "$PAGES_ROOT/manifests/pr-$pr-$short_sha.json" "\"commit\": \"$commit\"" \
    "PR installation manifest"
  if [[ "$current" == true ]]; then
    wait_for_publication \
      "$PAGES_ROOT/pr-$pr" "export WBS_REF='$commit'" \
      "current PR installer"
    wait_for_publication \
      "$PAGES_ROOT/manifests/pr-$pr.json" \
      "ghcr.io/wmde/wikibase/wikibase:pr-$pr" \
      "current PR installation manifest"
  fi
}

publish_release() {
  validate_origin_repository

  # shellcheck disable=SC1091
  source .wbs/version
  [[ "${WBS_VERSION:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
    echo "Invalid WBS_VERSION in .wbs/version." >&2
    exit 1
  }
  local release_ref="wbs@$WBS_VERSION"
  git rev-parse --verify --quiet "refs/tags/$release_ref" >/dev/null || {
    echo "Release tag $release_ref was not created." >&2
    exit 1
  }

  mkdir -p "$STATE_DIR"
  jq -n \
    --arg event_type publish-release \
    --arg origin_repository "$ORIGIN_REPOSITORY" \
    --arg source_repository "$ORIGIN_REPOSITORY" \
    --arg version "$WBS_VERSION" \
    '{
      event_type: $event_type,
      client_payload: {
        schemaVersion: 1,
        originRepository: $origin_repository,
        sourceRepository: $source_repository,
        version: $version
      }
    }' > "$RELEASE_PAYLOAD_PATH"

  dispatch_payload "$RELEASE_PAYLOAD_PATH"
  local expected="export WBS_REF='$release_ref'"
  wait_for_publication "$PAGES_ROOT/$WBS_VERSION" "$expected" \
    "Wikibase Suite $WBS_VERSION installer"
  wait_for_publication "$PAGES_ROOT/latest" "$expected" \
    "latest release installer"
  wait_for_publication "$PAGES_ROOT/" "$expected" \
    "canonical release installer"
}

case "${1:-}" in
  prepare-pr) prepare_pr ;;
  dispatch-pr) dispatch_pr ;;
  cleanup-pr) cleanup_pr ;;
  publish-release) publish_release ;;
  *)
    echo "Usage: $0 {prepare-pr|dispatch-pr|cleanup-pr|publish-release}" >&2
    exit 2
    ;;
esac
