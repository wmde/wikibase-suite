#!/usr/bin/env bash

set -u

cd "$(dirname "${BASH_SOURCE[0]}")/../../.." || exit

[ -f "development/local.env" ] || touch development/local.env
source development/local.env

# Default values
path="."
fix=false
prettier=false
exit_code=0

# Function to display help message
usage() {
  echo "Usage: wbs-dev lint <target> [--fix] [--prettier]"
  exit 1
}

# Error handler to capture errors
# shellcheck disable=SC2329 # spell check does not see the usage in the trap
error_handler() {
  # shellcheck disable=SC2317
  exit_code=1
}

# Trap ERR to handle errors
trap 'error_handler' ERR

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --fix|-f)
      fix=true
      shift
      ;;
    --prettier)
      prettier=true
      shift
      ;;
    *)
      path="$1"
      shift
      ;;
  esac
done

# Ensure path is a directory
if [[ ! -d $path ]]; then
  echo "Error: Path '$path' does not exist or is not a directory."
  usage
fi

# Linting JS, YAML, Python scripts, and general whitespace
if $fix; then
  echo "ℹ️ Fixing linting issues which can be fixed automatically"

  if $prettier; then
    echo "ℹ️ Pre-processing with Prettier"
    prettier "$path/**/*.{cjs,js,mjs,ts,vue,json}" --log-level error --write
    prettier "$path/**/*.md" --log-level error --config development/.prettierrc.json --write
    prettier "$path/**/*.{yml,yaml}" --log-level error --config development/.prettierrc.json --write
  fi

  echo "ℹ️ Running ESLint with fix"
  eslint "$path" --config eslint.config.mjs --fix

  echo "ℹ️ Running Black for Python"
  find "$path" -type d -name node_modules -prune -o -name '*.py' -print0 | xargs -0 -r \
    python3 -m black --quiet
else
  echo "ℹ️ Running ESLint (without --fix)"
  eslint "$path" --config eslint.config.mjs

  echo "ℹ️ Running Python Black on all *.py files (with --check)"
  find "$path" -type d -name node_modules -prune -o -name '*.py' -print0 | xargs -0 -r \
    python3 -m black --diff --quiet --check
fi

echo "ℹ️ Running shellcheck on *.sh files"
find "$path" \
  -type d \( \
    -name node_modules \
    -o -name .git \
    -o -path "$path/config/extensions" \
  \) \
  -prune -o \
  -type f -name "*.sh" -print0 | xargs -0 -r shellcheck -x

echo "ℹ️ Running hadolint on all Dockerfiles"
find "$path" -type d \( -name node_modules -o -name .git \) -prune -o -type f -name Dockerfile -print0 | xargs -0 -r \
  hadolint --config development/.hadolint.yml

exit $exit_code
