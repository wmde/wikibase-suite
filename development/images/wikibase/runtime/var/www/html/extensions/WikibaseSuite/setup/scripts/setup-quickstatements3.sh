#!/usr/bin/env bash

set -euo pipefail

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--regenerate-oauth" ) ]]; then
    echo "Usage: setup-quickstatements3.sh [--regenerate-oauth]" >&2
    exit 2
fi
regenerate_oauth=${1:-}

data_directory=/quickstatements3/data
if [[ ! -d "$data_directory" || -z "${QUICKSTATEMENTS3_PUBLIC_URL:-}" ]]; then
    if [[ -n "$regenerate_oauth" ]]; then
        echo "QuickStatements 3 requires a mounted data directory and QUICKSTATEMENTS3_PUBLIC_URL." >&2
        exit 1
    fi
    exit 0
fi

if [[ -z "$regenerate_oauth" && -s "$data_directory/runtime.json" ]]; then
    php /var/www/html/extensions/WikibaseSuite/setup/scripts/setup-quickstatements3.php \
        "$data_directory"
    echo "QuickStatements 3 database password synchronized."
    exit 0
fi

if [[ -z "${MW_ADMIN_NAME:-}" ]]; then
    echo "MW_ADMIN_NAME is required to provision QuickStatements 3 OAuth."
    exit 1
fi

temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

callback_url="${QUICKSTATEMENTS3_PUBLIC_URL%/}/auth/callback/"
php /var/www/html/extensions/OAuth/maintenance/createOAuthConsumer.php \
    --approve \
    --callbackUrl "$callback_url" \
    --description "QuickStatements 3" \
    --grants createeditmovepage \
    --grants editpage \
    --grants highvolume \
    --name "QuickStatements 3" \
    --oauthVersion 2 \
    --oauth2GrantTypes authorization_code \
    --oauth2GrantTypes refresh_token \
    --user "$MW_ADMIN_NAME" \
    --version 3.0.0 \
    --jsonOnSuccess > "$temporary_directory/oauth.json"

php /var/www/html/extensions/WikibaseSuite/setup/scripts/setup-quickstatements3.php \
    "$data_directory" \
    "$temporary_directory/oauth.json"
echo "QuickStatements 3 database access and OAuth 2 credentials provisioned."
if [[ -n "$regenerate_oauth" ]]; then
    echo "Restart QuickStatements 3 to load the new OAuth credentials."
fi
