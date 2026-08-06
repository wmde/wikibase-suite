#!/usr/bin/env bash
# This file is provided by the wikibase/wdqs docker image.

# Test if required environment variables have been set
REQUIRED_VARIABLES=(WIKIBASE_HOST WDQS_HOST WDQS_PORT)
for i in "${REQUIRED_VARIABLES[@]}"; do
  eval THISSHOULDBESET=\$"$i"
  if [ -z "$THISSHOULDBESET" ]; then
    echo "$i is required but isn't set. You should pass it to docker. See: https://docs.docker.com/engine/reference/commandline/run/#set-environment-variables--e---env---env-file";
    exit 1;
  fi
done

set -eu

# Options provided to WDQS (blazegraph) when running as query service instance
#
# Note: We MUST not provide -DwikibaseHost=${WIKIBASE_HOST} here, otherwise
# WDQS would re-use the wd: et al. prefixes for the local wikibase instance.
# This is unintended, especially in the context of federation. wd: prefixes
# should remain in place for referencing wikidata. The local instance should
# choose its own prefixes, as described here: 
# https://www.mediawiki.org/wiki/Wikibase/Wikibase.cloud/First_steps#View_your_data_using_the_Query_Service
# Some further thoughts on prefixes: https://phabricator.wikimedia.org/T335448
#
# In other words, WDQS does not know about the hostname of the wiki it gets
# its data from. Is is solely the task of the updater to feed data from the
# wiki into the WDQS instance.
export BLAZEGRAPH_OPTS="${BLAZEGRAPH_EXTRA_OPTS}"

# Options provided when running as wdqs-updater
#
# Here we provide -DwikibaseHost to reference the wiki to poll updates from.
export UPDATER_OPTS="-DwikibaseHost=${WIKIBASE_HOST} -DwikibaseMaxDaysBack=${WIKIBASE_MAX_DAYS_BACK}"

envsubst < /templates/mwservices.json > /wdqs/mwservices.json

exec $(echo "$@"| envsubst)
