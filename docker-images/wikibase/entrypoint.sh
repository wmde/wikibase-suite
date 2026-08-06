#!/usr/bin/env bash

# This file is provided by the wikibase/wikibase docker image.

# Exit immediately with message if no /config volume is available
if [ ! -d "/config" ]; then
    echo "A volume mapped to /config is required."
    exit 1
fi

# Exit immediate on errors or unset variables from here onwards
set -eu

if ! [ -v METADATA_CALLBACK  ] || [ -z "$METADATA_CALLBACK" ]; then
  echo "*** ERROR ***"
  echo "METADATA_CALLBACK not configured."
  echo "https://github.com/wmde/wikibase-suite/blob/main/docker-images/wikibase/README.md"
  echo "Exiting Wikibase container now."
  exit 1
fi

bash /callback.sh || true

# Take wikibase-php.ini from user config if present
if [ -e "/config/wikibase-php.ini" ]; then
    cp /config/wikibase-php.ini /usr/local/etc/php/conf.d/wikibase-php.ini

# Otherwise, make our stock wikibase-php.ini visible to the user for customization
else
    cp /usr/local/etc/php/conf.d/wikibase-php.ini /config/wikibase-php.ini
fi

if [ -e "/config/LocalSettings.php" ]; then
    cp /config/LocalSettings.php /var/www/html/LocalSettings.php
    # Always run update (this might be the first run off of a new image version on existing config and data)
    # TODO: Switch to the new way of running maintenance scripts after dropping 1.39 support end of 2025
    #php /var/www/html/maintenance/run.php update --quick
    php /var/www/html/maintenance/update.php --quick
else
    echo "/config/LocalSettings.php not found, running MediaWiki install."

    # Check for required  env vars
    set +u
    required_vars=(
        DB_SERVER
        DB_PASS
        DB_USER
        DB_NAME
        MW_ADMIN_NAME
        MW_ADMIN_EMAIL
        MW_ADMIN_PASS
        MW_WG_SERVER
        MW_WG_LANGUAGE_CODE
        MW_WG_SITENAME
    )
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo "$var is required but isn't set. You should pass it to Docker. See: https://docs.docker.com/engine/reference/commandline/run/#set-environment-variables--e---env---env-file"
            exit 1
        fi
    done
    set -u

    # Run MediaWiki install script, and update values
    # TODO: Switch to the new way of running maintenance scripts after dropping 1.39 support end of 2025
    #php /var/www/html/maintenance/run.php install \
    php /var/www/html/maintenance/install.php \
        --server "$MW_WG_SERVER" \
        --scriptpath "/w" \
        --dbuser "$DB_USER" \
        --dbpass "$DB_PASS" \
        --dbname "$DB_NAME" \
        --dbserver "$DB_SERVER" \
        --pass "$MW_ADMIN_PASS" \
        --lang "$MW_WG_LANGUAGE_CODE" \
        "$MW_WG_SITENAME" \
        "$MW_ADMIN_NAME"

    # Include WBS customizations to generated LocalSettings.php
    {
        echo
        echo '# Configuration added by Wikibase Suite installer in entrypoint.sh'
        echo
        if [[ -v ELASTICSEARCH_HOST ]]; then
            echo "\$elasticsearchHost = '$ELASTICSEARCH_HOST';"
        fi
        echo
        grep -v "<?php" /templates/LocalSettings.wbs.php
        echo
    } >> /var/www/html/LocalSettings.php

    # Replace /config/LocalSettings.php with newly generated LocalSettings.php
    cp /var/www/html/LocalSettings.php /config/LocalSettings.php
    # Update the MW Admin email address (if this admin user doesn't already exist, a new one will be created)
    # TODO: Switch to the new way of running maintenance scripts after dropping 1.39 support end of 2025
    #php /var/www/html/maintenance/run.php resetUserEmail --no-reset-password "$MW_ADMIN_NAME" "$MW_ADMIN_EMAIL"
    php /var/www/html/maintenance/resetUserEmail.php --no-reset-password "$MW_ADMIN_NAME" "$MW_ADMIN_EMAIL"

    # TODO: Switch to the new way of running maintenance scripts after dropping 1.39 support end of 2025
    #php /var/www/html/maintenance/run.php update --quick
    php /var/www/html/maintenance/update.php --quick

    if [ -f /default-extra-install.sh ]; then
        bash /default-extra-install.sh
    fi

    if [ -f /extra-install.sh ]; then
        bash /extra-install.sh
    fi
fi

# Run the actual entry point
docker-php-entrypoint apache2-foreground
