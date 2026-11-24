#!/usr/bin/env bash

set -euo pipefail

readonly INSTALLER_REPOSITORY="wmde/wikibase-suite-install"
readonly PAGES_ROOT="https://wmde.github.io/wikibase-suite-install"
readonly STATE_DIR="${RUNNER_TEMP:-/tmp}/wikibase-suite-installer"
readonly PREVIEW_PAYLOAD_PATH="$STATE_DIR/preview-dispatch.json"
readonly PR_CLEANUP_PAYLOAD_PATH="$STATE_DIR/pr-cleanup-dispatch.json"
readonly RELEASE_PAYLOAD_PATH="$STATE_DIR/release-dispatch.json"
declare -a IMAGES=()

load_images() {
  local source_commit="$1"
  # Read the image list from the built source commit without executing its code.
  git fetch --no-tags origin "$source_commit" >/dev/null
  mapfile -t IMAGES < <(
    git ls-tree -d --name-only "$source_commit:development/images" |
      grep -Ev '^(_|node_modules$)' |
      sort
  )
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

# CI invokes this only after the complete temporary image set has built. GitHub
# refs select the source; the manifest records the fixed images for that build.
prepare_preview() {
  validate_origin_repository
  [[ "${SOURCE_COMMIT:-}" =~ ^[0-9a-f]{40}$ ]] || {
    echo "Invalid preview source commit." >&2
    exit 1
  }
  [[ "${BUILD_TAG:-}" =~ ^dev-([1-9][0-9]*)-([1-9][0-9]*)$ ]] || {
    echo "Expected the CI run image tag dev-RUN-ATTEMPT." >&2
    exit 1
  }
  local build_id="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}"
  local build_run_id="${BASH_REMATCH[1]}"
  local build_run
  build_run="$(gh api "repos/$ORIGIN_REPOSITORY/actions/runs/$build_run_id")"
  if [[ "$(jq -r '.name' <<< "$build_run")" != 'Build and Test' ||
        "$(jq -r '.head_sha' <<< "$build_run")" != "$SOURCE_COMMIT" ]]; then
    echo "The CI image tag does not belong to the requested source commit." >&2
    exit 1
  fi
  local channel source_ref state pr_number='' branch=''
  if [[ "${PREVIEW_TARGET:-}" =~ ^pr-([1-9][0-9]*)$ ]]; then
    channel='pr'
    pr_number="${BASH_REMATCH[1]}"
    local pull_request
    pull_request="$(gh api "repos/$ORIGIN_REPOSITORY/pulls/$pr_number")"
    state="$(jq -r '.state' <<< "$pull_request")"
    [[ "$state" == open ]] || { echo "PR $pr_number is closed." >&2; exit 1; }
    [[ "$(jq -r '.head.repo.full_name' <<< "$pull_request")" == "$ORIGIN_REPOSITORY" ]] || {
      echo "Preview publication supports same-repository PRs only." >&2
      exit 1
    }
    source_ref="$(jq -r '.head.ref' <<< "$pull_request")"
    git check-ref-format --branch "$source_ref" >/dev/null
    if ! jq -e --argjson pr "$pr_number" \
      '.event == "pull_request" and any(.pull_requests[]; .number == $pr)' \
      <<< "$build_run" >/dev/null; then
      echo "The CI build does not belong to PR $pr_number." >&2
      exit 1
    fi
  elif [[ "${PREVIEW_TARGET:-}" =~ ^branch:(main|release/wbs-[1-9][0-9]*)$ ]]; then
    channel=branch
    branch="${BASH_REMATCH[1]}"
    source_ref="$branch"
    if ! jq -e --arg branch "$branch" \
      '(.event == "push" or .event == "workflow_dispatch") and .head_branch == $branch' \
      <<< "$build_run" >/dev/null; then
      echo "The CI build does not belong to branch $branch." >&2
      exit 1
    fi
  else
    echo "Expected pr-N or branch:main or branch:release/wbs-N." >&2
    exit 1
  fi
  load_images "$SOURCE_COMMIT"
  mkdir -p "$STATE_DIR"
  rm -f "$PREVIEW_PAYLOAD_PATH"

  local images_json='{}' image source digest
  for image_name in "${IMAGES[@]}"; do
    image="ghcr.io/wmde/wikibase/$image_name"
    # The assemble job creates the unsuffixed tag for multi-platform builds.
    # Otherwise CI publishes the AMD64 tag. The manifest records its digest.
    source="$image:$BUILD_TAG"
    if ! docker buildx imagetools inspect "$source" >/dev/null 2>&1; then
      source="$image:$BUILD_TAG-amd64"
    fi
    digest="$(docker buildx imagetools inspect "$source" \
      --format '{{json .Manifest}}' | jq -er '.digest')"
    [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || {
      echo "Invalid digest for $source." >&2
      exit 1
    }
    images_json="$(jq -c --arg name "$image_name" --arg image "$image@$digest" \
      '. + {($name): $image}' <<< "$images_json")"
  done

  jq -n \
    --arg event_type "publish-$channel-installation" \
    --arg origin_repository "$ORIGIN_REPOSITORY" \
    --arg source_repository "$ORIGIN_REPOSITORY" \
    --arg source_ref "$source_ref" \
    --arg branch "$branch" \
    --argjson pr "${pr_number:-0}" \
    --arg commit "$SOURCE_COMMIT" \
    --arg build_id "$build_id" \
    --argjson current true \
    --argjson images "$images_json" \
    '{event_type: $event_type, client_payload: ({
      schemaVersion: 1, originRepository: $origin_repository,
      sourceRepository: $source_repository, sourceRef: $source_ref,
      commit: $commit, buildId: $build_id, current: $current, images: $images
    } + (if $pr > 0 then {pr: $pr} else {branch: $branch} end))}' \
    > "$PREVIEW_PAYLOAD_PATH"
}

dispatch_preview() {
  dispatch_payload "$PREVIEW_PAYLOAD_PATH"
  local channel commit build_id short_sha alias immutable
  channel="$(jq -r '.event_type' "$PREVIEW_PAYLOAD_PATH")"
  commit="$(jq -r '.client_payload.commit' "$PREVIEW_PAYLOAD_PATH")"
  build_id="$(jq -r '.client_payload.buildId' "$PREVIEW_PAYLOAD_PATH")"
  short_sha="${commit:0:12}"
  if [[ "$channel" == publish-pr-installation ]]; then
    local pr
    pr="$(jq -r '.client_payload.pr' "$PREVIEW_PAYLOAD_PATH")"
    alias="pr-$pr"
    immutable="$alias-$short_sha-$build_id"
  else
    local branch
    branch="$(jq -r '.client_payload.branch' "$PREVIEW_PAYLOAD_PATH")"
    alias="branch-${branch//\//-}"
    immutable="$alias-$short_sha-$build_id"
  fi
  wait_for_publication "$PAGES_ROOT/$immutable" "export WBS_REF='$commit'" \
    "pinned preview installer"
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
  prepare-preview) prepare_preview ;;
  dispatch-preview) dispatch_preview ;;
  cleanup-pr) cleanup_pr ;;
  publish-release) publish_release ;;
  *)
    echo "Usage: $0 {prepare-preview|dispatch-preview|cleanup-pr|publish-release}" >&2
    exit 2
    ;;
esac
