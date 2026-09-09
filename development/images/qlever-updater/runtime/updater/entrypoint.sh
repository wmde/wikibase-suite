#!/bin/sh
set -eu

token_file=/data/qlever-access-token
export_token_file="${QLEVER_EXPORT_TOKEN_FILE:-/data/qlever-export-token}"

ensure_export_token() {
  if [ ! -s "$export_token_file" ]; then
    umask 077
    dd if=/dev/urandom bs=32 count=1 2>/dev/null | base64 > "$export_token_file"
  fi
  # Apache in the bundled Wikibase image runs as UID/GID 33. Give it read-only
  # access without making the export credential world-readable in query-data.
  chown root:33 "$export_token_file"
  chmod 0640 "$export_token_file"
}

ensure_export_token
QLEVER_EXPORT_TOKEN="$(cat "$export_token_file")"
export QLEVER_EXPORT_TOKEN
if [ "${1:-updater.php}" != 'bootstrap.php' ]; then
  [ -r "$token_file" ] || { echo 'Missing QLever access token in query-data.' >&2; exit 1; }
  QLEVER_ACCESS_TOKEN="$(cat "$token_file")"
  export QLEVER_ACCESS_TOKEN
fi

exec php "/updater/${1:-updater.php}"
