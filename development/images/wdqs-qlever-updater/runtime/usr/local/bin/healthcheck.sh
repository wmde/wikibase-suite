#!/bin/sh
set -eu

health_file=/data/wdqs-qlever-updater-health.json

test -f "$health_file"
test "$(( $(date +%s) - $(stat -c %Y "$health_file") ))" -lt 90
