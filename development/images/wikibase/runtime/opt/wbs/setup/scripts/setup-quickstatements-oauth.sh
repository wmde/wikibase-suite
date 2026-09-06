#!/usr/bin/env bash

set -ex

if [ -z "${QUICKSTATEMENTS_PUBLIC_URL:-}" ] ; then
    echo "OAuth Skipping QuickStatements setup... QUICKSTATEMENTS_PUBLIC_URL not set"
else
    # Attempt to create OAuth consumer for QuickStatements
    if php /var/www/html/extensions/OAuth/maintenance/createOAuthConsumer.php \
        --approve \
        --callbackUrl  "$QUICKSTATEMENTS_PUBLIC_URL/api.php" \
        --callbackIsPrefix true --user "$MW_ADMIN_NAME" --name QuickStatements --description QuickStatements --version 1.0.1 \
        --grants createeditmovepage --grants editpage --grants highvolume --jsonOnSuccess > /quickstatements/data/qs-oauth.json; then
        # Check if JSON file was created
        if [[ -f /quickstatements/data/qs-oauth.json ]]; then
            OAUTH_CONSUMER_KEY=$(grep -o '"key":"[^"]*' /quickstatements/data/qs-oauth.json | grep -o '[^"]*$')
            OAUTH_CONSUMER_SECRET=$(grep -o '"secret":"[^"]*' /quickstatements/data/qs-oauth.json | grep -o '[^"]*$')

            export OAUTH_CONSUMER_KEY
            export OAUTH_CONSUMER_SECRET

            cat > /quickstatements/data/oauth.ini <<EOF
; HTTP User-Agent header
agent = 'Wikibase Docker QuickStatements'
consumerKey = '${OAUTH_CONSUMER_KEY}'
consumerSecret = '${OAUTH_CONSUMER_SECRET}'
EOF
        else
            echo "OAuth qs-oauth.json not created, skipped oauth.ini creation"
        fi
    else
        echo "OAuth consumer creation failed, check errors above."
    fi
fi
