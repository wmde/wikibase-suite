#!/bin/sh
set -eu

exec java -Dquarkus.http.host=0.0.0.0 -cp . -jar quarkus-run.jar "$@"
