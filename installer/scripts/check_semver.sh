#!/usr/bin/env bash

# check_semver
# Usage:
#   _check_semver MIN [ACTUAL]
#   echo ACTUAL | _check_semver MIN
# Exit 0 if ACTUAL >= MIN, else 1. No output.

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: _check_semver MIN [ACTUAL] (or: ACTUAL on stdin)" >&2
  exit 2
fi

min="$1"
if [[ $# -eq 2 ]]; then
  actual="$2"
else
  read -r actual || actual=""
fi

# Extract first version-like token (handles "v2.39.2", commas, extra text)
_extract_first_version() {
  printf '%s' "$1" | grep -oE -m1 'v?[0-9]+(\.[0-9]+){1,2}' || true
}

# Normalize: strip leading v, cut non-numeric, ensure 3 components
_norm() {
  local v="${1#v}"
  v="${v%%[^0-9.]*}"
  IFS='.' read -r a b c <<<"$v"
  a="${a:-0}"; b="${b:-0}"; c="${c:-0}"
  printf "%d.%d.%d\n" "$a" "$b" "$c"
}

# Make ACTUAL robust to raw strings like "Docker version 28.3.3, build …"
actual="$(_extract_first_version "$actual")"
if [[ -z "$actual" ]]; then
  exit 2
fi

minVersion=$(_norm "$min")
actualVersion=$(_norm "$actual")

IFS='.' read -r minMajor minMinor minPatch <<<"$minVersion"
IFS='.' read -r actualMajor actualMinor actualPatch <<<"$actualVersion"

# Compare
if   (( actualMajor >  minMajor )); then exit 0
elif (( actualMajor == minMajor )); then
  if   (( actualMinor >  minMinor )); then exit 0
  elif (( actualMinor == minMinor )); then
    if (( actualPatch >= minPatch )); then exit 0; fi
  fi
fi

exit 1
