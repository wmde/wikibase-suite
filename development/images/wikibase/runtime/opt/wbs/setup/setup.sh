#!/usr/bin/env bash

# WBS-owned install/update lifecycle. Keep this separate from application
# startup so externally managed deployments can use the packaged application
# without a persistent /config volume.

# Exit immediately with message if no /config volume is available
if [ ! -d "/config" ]; then
    echo "A volume mapped to /config is required for WBS configuration."
    exit 1
fi

# The callback is opt-in. Treat an omitted or empty value as disabled so this
# optional WBS service does not prevent an otherwise valid image from starting.
export METADATA_CALLBACK="${METADATA_CALLBACK:-false}"

# Exit immediately on errors or unset variables from here onwards
set -eu

bash /opt/wbs/setup/scripts/metadata-callback.sh || true

# Take wikibase-php.ini from user config if present
if [ -e "/config/wikibase-php.ini" ]; then
    cp /config/wikibase-php.ini /usr/local/etc/php/conf.d/wikibase-php.ini

# Otherwise, make our stock wikibase-php.ini visible to the user for customization
else
    cp /usr/local/etc/php/conf.d/wikibase-php.ini /config/wikibase-php.ini
fi

instance_settings=/config/InstanceSettings.php
custom_settings=/config/LocalSettings.php
image_state_directory=/config/.wikibase-image
migration_directory=$image_state_directory/config-migration
installation_state_file=$image_state_directory/installation-state

ensure_image_state_directory() {
    mkdir -p "$image_state_directory"
}

remove_image_state_directory_if_empty() {
    rmdir "$image_state_directory" 2> /dev/null || true
}

set_installation_phase() {
    next_phase=$1
    ensure_image_state_directory
    printf '%s\n' "$next_phase" > "$installation_state_file.tmp"
    mv "$installation_state_file.tmp" "$installation_state_file"
}

resume_fresh_installation() {
    current_phase=$(cat "$installation_state_file")

    if [ "$current_phase" = configured ]; then
        php /var/www/html/maintenance/run.php installPreConfigured
        set_installation_phase database-installed
        current_phase=database-installed
    fi
    if [ "$current_phase" = database-installed ]; then
        # installPreConfigured creates the core and extension tables, but a
        # normal update is still needed for extensions using a virtual domain.
        php /var/www/html/maintenance/run.php update --quick
        set_installation_phase database-updated
        current_phase=database-updated
    fi
    if [ "$current_phase" = database-updated ]; then
        php /var/www/html/maintenance/run.php createAndPromote \
            --force \
            --sysop \
            --bureaucrat \
            --interface-admin \
            --email "$MW_ADMIN_EMAIL" \
            "$MW_ADMIN_NAME" \
            "$MW_ADMIN_PASS"
        set_installation_phase administrator-created
        current_phase=administrator-created
    fi
    if [ "$current_phase" = administrator-created ]; then
        bash /opt/wbs/setup/scripts/create-opensearch-index.sh
        bash /opt/wbs/setup/scripts/setup-quickstatements-oauth.sh

        if [ -f /extra-install.sh ]; then
            bash /extra-install.sh
        fi
        rm -f "$installation_state_file"
        remove_image_state_directory_if_empty
        return
    fi
    echo "Unknown WBS installation phase: $current_phase"
    exit 1
}

resume_interrupted_installation() {
    ensure_image_state_directory
    if [ "$(cat "$installation_state_file")" = preparing ]; then
        if [ ! -r "$instance_settings" ] || [ ! -r "$custom_settings" ]; then
            php /opt/wbs/setup/Configuration.php fresh "$instance_settings" "$custom_settings"
        fi
        set_installation_phase configured
    fi
    echo "Resuming WBS installation at phase $(cat "$installation_state_file")."
    resume_fresh_installation
}

update_existing_installation() {
    # These values are inputs to initial setup. Existing configuration is authoritative.
    unset \
        DB_SERVER DB_PASS DB_USER DB_NAME \
        MW_ADMIN_NAME MW_ADMIN_EMAIL MW_ADMIN_PASS \
        MW_WG_SERVER MW_WG_LANGUAGE_CODE MW_WG_SITENAME \
        ELASTICSEARCH_HOST
    php /var/www/html/maintenance/run.php update --quick
}

install_new_instance() {
    echo "No instance configuration found; installing MediaWiki from the image-owned configuration."

    # Check for required environment variables
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
            echo "$var is required but isn't set. You should pass it to Docker. See: https://docs.docker.com/engine/reference/commandline/run/#set-environment-variables--e---env-file"
            exit 1
        fi
    done
    set -u

    set_installation_phase preparing
    php /opt/wbs/setup/Configuration.php fresh "$instance_settings" "$custom_settings"
    set_installation_phase configured
    resume_fresh_installation
}

# Persistent artifacts determine which idempotent lifecycle action is safe.
# Test the interrupted operations first because their working files may include
# otherwise valid InstanceSettings.php and LocalSettings.php files.
if [ -d "$migration_directory" ]; then
    bash /opt/wbs/setup/migration/migrate.sh
elif [ -e "$installation_state_file" ]; then
    resume_interrupted_installation
elif [ -e "$instance_settings" ]; then
    update_existing_installation
elif [ -e "$custom_settings" ]; then
    bash /opt/wbs/setup/migration/migrate.sh
else
    install_new_instance
fi
