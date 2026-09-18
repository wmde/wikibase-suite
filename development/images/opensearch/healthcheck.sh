#!/usr/bin/env bash

# Ref. https://github.com/docker-library/healthcheck/blob/master/elasticsearch/docker-healthcheck

set -eo pipefail

host="$(hostname --ip-address || echo '127.0.0.1')"

if health="$(curl -fsSL "http://$host:9200/_cat/health?h=status")"; then
	health="$(echo "$health" | sed -r 's/^[[:space:]]+|[[:space:]]+$//g')"
	if [ "$health" = 'green' ]; then
		exit 0
	fi
	echo >&2 "unexpected health status: $health"
fi

exit 1
