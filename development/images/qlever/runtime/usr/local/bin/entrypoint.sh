#!/bin/sh
set -eu

token_file=/data/qlever-access-token
# Restrict federated SERVICE requests by default. Separate prefixes with
# whitespace; advanced deployments can replace this list through the runtime
# environment without putting it in the Suite .env example.
service_allowed_iri_prefixes=${QLEVER_SERVICE_ALLOWED_IRI_PREFIXES:-https://query.wikidata.org/}

ensure_access_token() {
  [ -s "$token_file" ] && return
  umask 077
  dd if=/dev/urandom bs=32 count=1 2>/dev/null | base64 > "$token_file"
}

initialize_empty_index() {
  [ -f /data/wikibase.meta-data.json ] && return
  echo 'No QLever index found; initializing an empty index.' >&2
  : > /data/wikibase.nq
  qlever --qleverfile /etc/qlever/Qleverfile index --overwrite-existing
  rm -f /data/wikibase.update-triples /data/qlever-bootstrap.lock \
    /data/wdqs-qlever-updater-paused.json /data/qlever-bootstrap-required
}

case "${1:-server}" in
  server)
    shift
    initialize_empty_index
    ensure_access_token
    # The QLever option accepts one or more IRI prefixes. Intentional shell
    # splitting turns the whitespace-separated runtime setting into arguments.
    # shellcheck disable=SC2086
    set -- --service-allowed-iri-prefixes $service_allowed_iri_prefixes "$@"
    exec qlever-server -i wikibase -j "${QLEVER_THREADS:-2}" -p 7001 \
      -m "${QLEVER_QUERY_MEMORY:-256M}" -c "${QLEVER_CACHE_MEMORY:-64M}" \
      -e "${QLEVER_MAX_RESULT_SIZE:-32M}" -k "${QLEVER_MAX_CACHED_RESULTS:-100}" \
      -a "$(cat "$token_file")" --persist-updates "$@"
    ;;
  index)
    shift
    rm -f /data/wikibase.update-triples
    qlever --qleverfile /etc/qlever/Qleverfile index --overwrite-existing "$@"
    status=$?
    if [ "$status" -eq 0 ]; then
      rm -f /data/qlever-bootstrap.lock /data/wdqs-qlever-updater-paused.json /data/qlever-bootstrap-required
    fi
    exit "$status"
    ;;
  *)
    exec "$@"
    ;;
esac
