#!/usr/bin/env bash
set -euo pipefail

candidate_version=${1:?Usage: promote-wikibase-latest.sh MAJOR.MINOR.PATCH}
image=wikibase/wikibase
stable_version='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'

if [[ ! $candidate_version =~ $stable_version ]]; then
  echo "Invalid Wikibase image version: $candidate_version" >&2
  exit 1
fi

# Read only registry metadata. If either tag or version label cannot be read,
# fail closed instead of risking a move of latest to an older release line.
candidate=$(docker buildx imagetools inspect "$image:$candidate_version" --format '{{json .}}')
published_version=$(jq -er '(.image["linux/amd64"] // .image).config.Labels["org.opencontainers.image.version"]' <<< "$candidate")
if [[ $published_version != "$candidate_version" ]]; then
  echo "Published image version $published_version does not match $candidate_version." >&2
  exit 1
fi
digest=$(jq -er '.manifest.digest | select(test("^sha256:[0-9a-f]{64}$"))' <<< "$candidate")

current=$(docker buildx imagetools inspect "$image:latest" --format '{{json .}}')
current_version=$(jq -er '(.image["linux/amd64"] // .image).config.Labels["org.opencontainers.image.version"]' <<< "$current")
if [[ ! $current_version =~ $stable_version ]]; then
  echo "Cannot compare the version currently behind $image:latest: $current_version" >&2
  exit 1
fi

if jq -ne --arg candidate "$candidate_version" --arg current "$current_version" \
  '($candidate | split(".") | map(tonumber)) > ($current | split(".") | map(tonumber))' \
  >/dev/null; then
  docker buildx imagetools create --tag "$image:latest" "$image@$digest"
  echo "Promoted $image:$candidate_version to $image:latest."
else
  echo "Kept $image:latest at $current_version; $candidate_version is not newer."
fi
