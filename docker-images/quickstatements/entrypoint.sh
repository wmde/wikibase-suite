#!/usr/bin/env bash

# Test if required environment variables have been set
REQUIRED_VARIABLES=(QUICKSTATEMENTS_PUBLIC_URL WIKIBASE_PUBLIC_URL WB_PROPERTY_NAMESPACE WB_PROPERTY_PREFIX WB_ITEM_NAMESPACE WB_ITEM_PREFIX)
for i in "${REQUIRED_VARIABLES[@]}"; do
    if ! [[ -v "$i" ]]; then
    echo "$i is required but isn't set. You should pass it to docker. See: https://docs.docker.com/engine/reference/commandline/run/#set-environment-variables--e---env---env-file";
    exit 1;
    fi
done

if [[ -v OAUTH_CONSUMER_KEY && -v OAUTH_CONSUMER_SECRET ]]; then
    envsubst < /templates/oauth.ini > /quickstatements/data/oauth.ini;
fi

envsubst < /templates/config.json > /var/www/html/quickstatements/public_html/config.json
envsubst < /templates/php.ini > /usr/local/etc/php/conf.d/php.ini

docker-php-entrypoint apache2-foreground
