#!/bin/sh
set -eu

token_file=/data/qlever-access-token

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
    /data/qlever-updater-paused.json /data/qlever-bootstrap-required
}

case "${1:-server}" in
  server)
    shift
    initialize_empty_index
    ensure_access_token
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
      rm -f /data/qlever-bootstrap.lock /data/qlever-updater-paused.json /data/qlever-bootstrap-required
    fi
    exit "$status"
    ;;
  *)
    exec "$@"
    ;;
esac
