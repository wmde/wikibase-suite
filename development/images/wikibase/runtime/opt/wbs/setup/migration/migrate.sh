#!/usr/bin/env bash

# Migrate a WBS 7 generated configuration to the current split configuration.
# This script owns all migration state so setup.sh can remain a concise image
# lifecycle dispatcher.

set -eu

instance_settings=/config/InstanceSettings.php
custom_settings=/config/LocalSettings.php
image_state_directory=/config/.wikibase-image
migration_directory=$image_state_directory/config-migration
staged_instance_settings=$migration_directory/InstanceSettings.php
staged_custom_settings=$migration_directory/LocalSettings.php

ensure_image_state_directory() {
    mkdir -p "$image_state_directory"
}

remove_image_state_directory_if_empty() {
    rmdir "$image_state_directory" 2> /dev/null || true
}

install_staged_configuration() {
    if [ ! -r "$staged_instance_settings" ] || [ ! -r "$staged_custom_settings" ]; then
        echo "The staged WBS 8 configuration migration is incomplete."
        exit 1
    fi
    php /opt/wbs/setup/migration/MigrateConfiguration.php install \
        "$staged_instance_settings" \
        "$instance_settings"
    php /opt/wbs/setup/migration/MigrateConfiguration.php install \
        "$staged_custom_settings" \
        "$custom_settings"
}

is_recognized_legacy_configuration() {
    grep -q '^# End of generated LocalSettings.php$' "$custom_settings"
}

migrate_legacy_configuration() {
    legacy_settings=$custom_settings
    backup_directory=/config/backups
    actual_configuration=/tmp/LocalSettings.actual.json
    reference_configuration=/tmp/LocalSettings.reference.json
    temporary_instance=$migration_directory/InstanceSettings.php.tmp
    legacy_prefix=/tmp/LocalSettings.legacy-prefix.php

    echo "Legacy LocalSettings.php found; preserving and migrating it."
    ensure_image_state_directory
    mkdir -p "$backup_directory" "$migration_directory"
    if [ ! -e "$backup_directory/LocalSettings.pre-wbs-8.php.backup" ]; then
        cp "$legacy_settings" "$backup_directory/LocalSettings.pre-wbs-8.php.backup"
    fi
    legacy_shape=$(php /opt/wbs/setup/migration/MigrateConfiguration.php write-loadable-legacy-config \
        "$legacy_settings" \
        "$legacy_prefix")
    echo "Recognized $legacy_shape generated configuration."
    php /var/www/html/maintenance/run.php getConfiguration \
        --conf "$legacy_prefix" \
        --format=json \
        --json-partial-output-on-error > "$actual_configuration"
    php /opt/wbs/setup/migration/MigrateConfiguration.php stage-instance-settings \
        "$legacy_settings" \
        "$actual_configuration" \
        "$temporary_instance"
    php /var/www/html/maintenance/run.php getConfiguration \
        --conf /opt/wbs/setup/migration/ReferenceConfig.php \
        --format=json \
        --json-partial-output-on-error > "$reference_configuration"
    php /opt/wbs/setup/migration/MigrateConfiguration.php stage-migrated-configuration \
        "$legacy_settings" \
        "$actual_configuration" \
        "$reference_configuration" \
        "$staged_custom_settings" \
        "$temporary_instance" \
        "$staged_instance_settings"
    rm -f "$actual_configuration" "$reference_configuration" "$legacy_prefix"
    install_staged_configuration
    echo "Legacy configuration saved in $backup_directory."
}

resume_configuration_migration() {
    ensure_image_state_directory
    if [ ! -r "$staged_instance_settings" ] || [ ! -r "$staged_custom_settings" ]; then
        if ! is_recognized_legacy_configuration; then
            echo "The interrupted WBS 8 configuration migration cannot be resumed."
            exit 1
        fi
        migrate_legacy_configuration
    else
        echo "Resuming the WBS 8 configuration migration."
        install_staged_configuration
    fi
    php /var/www/html/maintenance/run.php update --quick
    rm -rf "$migration_directory"
    remove_image_state_directory_if_empty
}

if [ -d "$migration_directory" ]; then
    resume_configuration_migration
elif [ -e "$custom_settings" ]; then
    if ! is_recognized_legacy_configuration; then
        echo "$custom_settings exists without $instance_settings and is not a recognized Wikibase Suite 7 configuration."
        exit 1
    fi
    migrate_legacy_configuration
    php /var/www/html/maintenance/run.php update --quick
    rm -rf "$migration_directory"
    remove_image_state_directory_if_empty
else
    echo "No legacy configuration is available to migrate."
    exit 1
fi
