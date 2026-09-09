#!/bin/sh
set -eu

token_file=/data/qlever-access-token
if [ "${1:-updater.php}" != 'bootstrap.php' ]; then
  [ -r "$token_file" ] || { echo 'Missing QLever access token in query-data.' >&2; exit 1; }
  QLEVER_ACCESS_TOKEN="$(cat "$token_file")"
  export QLEVER_ACCESS_TOKEN
fi

exec php "/updater/${1:-updater.php}"
