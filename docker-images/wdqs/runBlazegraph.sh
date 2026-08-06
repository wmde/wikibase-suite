#!/usr/bin/env bash
# This file is provided by the wikibase/wdqs docker image.

cd /wdqs || exit

./runBlazegraph.sh "$@"
