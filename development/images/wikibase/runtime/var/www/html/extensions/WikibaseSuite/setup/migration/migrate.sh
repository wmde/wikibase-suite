#!/usr/bin/env bash

# Migrate a WBS 1–7 generated configuration retained by a WBS 7 installation.
# This script owns all migration state so setup.sh can remain a concise image
# lifecycle dispatcher.

set -Eeuo pipefail

migration_directory_path=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

instance_settings=/config/InstanceSettings.php
custom_settings=/config/LocalSettings.php
image_state_directory=/config/.wikibase-image
migration_directory=$image_state_directory/config-migration
staged_instance_settings=$migration_directory/InstanceSettings.php
staged_custom_settings=$migration_directory/LocalSettings.php
original_custom_settings=$migration_directory/OriginalLocalSettings.php
support_ticket_url=https://phabricator.wikimedia.org/maniphest/task/edit/form/129/

on_exit() {
    status=$1
    if [ "$status" -eq 0 ]; then
        return
    fi
    # An unrecognized layout is rejected before creating migration state. PHP
    # has already printed the complete guidance for this case.
    if [ "$status" -eq 2 ] && [ ! -d "$migration_directory" ] && [ ! -e "$instance_settings" ]; then
        return
    fi
    # A preparation failure has not touched active configuration. Discard only
    # our working files so the operator can correct the original and retry.
    if [ ! -d "$migration_directory" ] && [ ! -e "$instance_settings" ]; then
        echo "The active configuration is unchanged." >&2
    elif [ -r "$original_custom_settings" ] && [ ! -e "$instance_settings" ] && \
        cmp -s "$custom_settings" "$original_custom_settings"; then
        rm -rf "$migration_directory"
        remove_image_state_directory_if_empty
        echo "The active configuration is unchanged. Its pre-upgrade backup is in /config/backups/." >&2
    else
        echo "Migration state was retained for recovery; active configuration may be partly installed." >&2
    fi
    echo "For additional help from the Wikibase Suite team, open a ticket at:" >&2
    echo "$support_ticket_url" >&2
    if [ -d "$migration_directory" ] || [ -e /config/backups/LocalSettings.pre-wbs-8.php.backup ]; then
        echo "Keep config/backups/ and any retained migration state for diagnosis." >&2
    fi
}
trap 'on_exit "$?"' EXIT

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
    if [ -e "$instance_settings" ] && ! cmp -s "$instance_settings" "$staged_instance_settings"; then
        echo "InstanceSettings.php changed during migration; preserving it for support to review." >&2
        exit 1
    fi
    if ! cmp -s "$custom_settings" "$original_custom_settings" && \
        ! cmp -s "$custom_settings" "$staged_custom_settings"; then
        echo "LocalSettings.php changed during migration; preserving it for support to review." >&2
        exit 1
    fi
    php "$migration_directory_path/MigrateConfiguration.php" validate \
        "$staged_instance_settings" "$staged_custom_settings"
    php -l "$staged_instance_settings" > /dev/null
    php -l "$staged_custom_settings" > /dev/null
    if [ -f /config/Extensions.php ]; then
        php -l /config/Extensions.php > /dev/null
    fi
    php "$migration_directory_path/MigrateConfiguration.php" install \
        "$staged_instance_settings" \
        "$instance_settings"
    php "$migration_directory_path/MigrateConfiguration.php" install \
        "$staged_custom_settings" \
        "$custom_settings"
}

is_recognized_legacy_configuration() {
    grep -Eq $'^# End of generated LocalSettings[.]php\r?$' "$custom_settings"
}

migrate_legacy_configuration() {
    legacy_settings=$custom_settings
    backup_directory=/config/backups
    actual_configuration=/tmp/LocalSettings.actual.json
    reference_configuration=/tmp/LocalSettings.reference.json
    temporary_instance=$migration_directory/InstanceSettings.php.tmp
    legacy_prefix=/tmp/LocalSettings.legacy-prefix.php

    legacy_shape=$(php "$migration_directory_path/MigrateConfiguration.php" write-loadable-legacy-config \
        "$legacy_settings" \
        "$legacy_prefix")
    echo "Legacy LocalSettings.php found; preserving and migrating it."
    echo "Recognized $legacy_shape generated configuration."
    ensure_image_state_directory
    mkdir -p "$backup_directory" "$migration_directory"
    if [ ! -e "$backup_directory/LocalSettings.pre-wbs-8.php.backup" ]; then
        cp "$legacy_settings" "$backup_directory/LocalSettings.pre-wbs-8.php.backup"
    fi
    cp "$legacy_settings" "$original_custom_settings"
    php /var/www/html/maintenance/run.php getConfiguration \
        --conf "$legacy_prefix" \
        --format=json \
        --json-partial-output-on-error > "$actual_configuration"
    php "$migration_directory_path/MigrateConfiguration.php" stage-instance-settings \
        "$legacy_settings" \
        "$actual_configuration" \
        "$temporary_instance"
    php /var/www/html/maintenance/run.php getConfiguration \
        --conf "$migration_directory_path/ReferenceConfig.php" \
        --format=json \
        --json-partial-output-on-error > "$reference_configuration"
    php "$migration_directory_path/MigrateConfiguration.php" stage-migrated-configuration \
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
        echo "$custom_settings exists without $instance_settings and is not a recognized WBS 1–7 generated configuration."
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
