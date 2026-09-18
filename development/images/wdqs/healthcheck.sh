#!/usr/bin/env bash

set -eu

curl --silent --fail http://localhost:9999/bigdata/namespace/wdq/sparql > /dev/null
