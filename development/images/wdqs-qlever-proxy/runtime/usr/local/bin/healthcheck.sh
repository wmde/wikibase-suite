#!/bin/sh
set -eu

curl --silent --fail http://localhost:8090/health
