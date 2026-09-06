#!/usr/bin/env bash

# Runtime dispatcher for the wikibase/wikibase application image.

set -eu

requested_workload="${1:-web}"

case "$requested_workload" in
    web|apache2-foreground)
        workload=web
        if [ "$#" -gt 0 ]; then
            shift
        fi
        ;;
    jobrunner)
        workload=jobrunner
        shift
        ;;
    maintenance)
        workload=maintenance
        shift
        ;;
    *)
        workload='command'
        ;;
esac

# Custom commands retain the base PHP image behavior and intentionally bypass
# MediaWiki configuration preparation.
if [ "$workload" = 'command' ]; then
    exec docker-php-entrypoint "$@"
fi

# MW_CONFIG_FILE is the configuration ownership boundary. The image default is
# its WBS configuration entry point. Replacing that default selects a complete
# externally managed configuration and bypasses WBS preparation.
wbs_settings_file=/opt/wbs/Settings.php
if [ "${MW_CONFIG_FILE:-}" = "$wbs_settings_file" ]; then
    if [ "$workload" = 'web' ]; then
        /opt/wbs/setup/setup.sh
    elif [ ! -r /config/InstanceSettings.php ]; then
        echo "/config/InstanceSettings.php is required for the $workload workload."
        exit 1
    fi
fi

case "$workload" in
    web)
        exec docker-php-entrypoint apache2-foreground "$@"
        ;;
    jobrunner)
        # Originally inspired by Brennen Bearnes jobrunner entrypoint
        # https://gerrit.wikimedia.org/r/plugins/gitiles/releng/dev-images/+/refs/heads/master/common/jobrunner/entrypoint.sh
        runner_pid=''
        stop_jobrunner() {
            if [ -n "$runner_pid" ]; then
                kill "$runner_pid" 2> /dev/null || true
            fi
        }
        trap stop_jobrunner TERM INT

        while true; do
            php /var/www/html/maintenance/run.php runJobs \
                --wait \
                --maxjobs="${JOBRUNNER_MAX_JOBS:-5}" \
                "$@" &
            runner_pid=$!
            wait "$runner_pid" || true
        done
        ;;
    maintenance)
        if [ "$#" -eq 0 ]; then
            echo "Usage: /entrypoint.sh maintenance <maintenance-command> [arguments...]"
            echo "Example: /entrypoint.sh maintenance update --quick"
            exit 64
        fi
        exec php /var/www/html/maintenance/run.php "$@"
        ;;
esac
