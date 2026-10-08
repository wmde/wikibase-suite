#!/usr/bin/env bash

set -euo pipefail

config_file=/quickstatements3/data/runtime.json
if [[ -s "$config_file" ]]; then
    echo "QuickStatements 3 credentials are already provisioned."
    exit 0
fi
if [[ -z "${QUICKSTATEMENTS_PUBLIC_URL:-}" ]]; then
    echo "QUICKSTATEMENTS_PUBLIC_URL is required to provision QuickStatements 3 OAuth."
    exit 1
fi

temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

php /var/www/html/extensions/WikibaseSuite/setup/scripts/provision-quickstatements3-database.php \
    > "$temporary_directory/database.json"

callback_url="${QUICKSTATEMENTS_PUBLIC_URL%/}/auth/callback/"
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

php /var/www/html/extensions/WikibaseSuite/setup/scripts/write-quickstatements3-config.php \
    "$temporary_directory/database.json" \
    "$temporary_directory/oauth.json" \
    "$config_file"
chmod 0600 "$config_file"
echo "QuickStatements 3 database and OAuth 2 credentials provisioned."
