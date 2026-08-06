#!/usr/bin/env bash
# This file is provided by the wikibase/wdqs docker image.

set -u

readonly MEDIAWIKI_API_PATH="/w/api.php"
readonly WDQS_SPARQL_PATH="/bigdata/namespace/wdq/sparql"

wdqs_is_empty() {
  local response

  if ! response=$(curl --silent --show-error --fail --get \
    --header "Accept: application/sparql-results+json" \
    --data-urlencode "query=ASK { ?entity <http://schema.org/version> ?version }" \
    "http://${WDQS_HOST}:${WDQS_PORT}${WDQS_SPARQL_PATH}"); then
    echo "Could not determine whether WDQS contains entities; skipping automatic updater initialization." >&2
    return 2
  fi

  if grep --extended-regexp --quiet '"boolean"[[:space:]]*:[[:space:]]*false' <<< "$response"; then
    return 0
  fi

  if grep --extended-regexp --quiet '"boolean"[[:space:]]*:[[:space:]]*true' <<< "$response"; then
    return 1
  fi

  echo "WDQS returned an unexpected response to the entity check; skipping automatic updater initialization." >&2
  return 2
}

wikibase_update_start() {
  local entity_namespaces
  local response
  local timestamp

  entity_namespaces=${WDQS_ENTITY_NAMESPACES//,/|}
  entity_namespaces=${entity_namespaces//[[:space:]]/}
  if [[ -z "$entity_namespaces" ]]; then
    echo "WDQS_ENTITY_NAMESPACES is empty; skipping automatic updater initialization." >&2
    return 2
  fi

  if ! response=$(curl --silent --show-error --fail --get \
    --data-urlencode "action=query" \
    --data-urlencode "list=recentchanges" \
    --data-urlencode "rcdir=newer" \
    --data-urlencode "rclimit=1" \
    --data-urlencode "rcnamespace=${entity_namespaces}" \
    --data-urlencode "rcprop=timestamp" \
    --data-urlencode "format=json" \
    --data-urlencode "formatversion=2" \
    "${WIKIBASE_SCHEME}://${WIKIBASE_HOST}${MEDIAWIKI_API_PATH}"); then
    echo "Could not read Wikibase RecentChanges; skipping automatic updater initialization." >&2
    return 2
  fi

  if grep --extended-regexp --quiet '"recentchanges"[[:space:]]*:[[:space:]]*\[[[:space:]]*\]' <<< "$response"; then
    date --utc +%Y%m%d000000
    return 0
  fi

  timestamp=$(grep --only-matching --extended-regexp '"timestamp"[[:space:]]*:[[:space:]]*"[^"]+"' <<< "$response" | \
    sed --expression 's/.*"timestamp"[[:space:]]*:[[:space:]]*"\([^"]*\)"/\1/' | \
    head --lines 1)
  if [[ ! "$timestamp" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$ ]]; then
    echo "Wikibase returned an unexpected response to the RecentChanges query; skipping automatic updater initialization." >&2
    return 2
  fi

  timestamp=${timestamp%%T*}
  printf '%s000000\n' "${timestamp//-/}"
}

main() {
  local -a initialization_args=()
  local update_start

  set +u
  if [[ -z "$WIKIBASE_CONCEPT_URI" ]]; then
    echo "WIKIBASE_CONCEPT_URI is required but isn't set."
    exit 1
  fi
  set -u

  cd /wdqs || exit

  /wait-for-it.sh "$WIKIBASE_HOST:80" -t 300 -- \
  /wait-for-it.sh "$WDQS_HOST:$WDQS_PORT" -t 300

  if wdqs_is_empty && update_start=$(wikibase_update_start); then
    initialization_args=(--init --start "$update_start")
    echo "WDQS contains no entities; initializing the updater from ${update_start}."
  fi

  exec ./runUpdate.sh -h "http://${WDQS_HOST}:${WDQS_PORT}" -- \
    --wikibaseUrl "${WIKIBASE_SCHEME}://${WIKIBASE_HOST}" \
    --conceptUri "$WIKIBASE_CONCEPT_URI" \
    --entityNamespaces "$WDQS_ENTITY_NAMESPACES" \
    "${initialization_args[@]}"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
