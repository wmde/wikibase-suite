#!/usr/bin/env bash

set -ex

if [ -z "${ELASTICSEARCH_HOST:-}" ] ; then
    echo "Skipping OpenSearch setup ..."
else
    # shellcheck disable=2153 # do not warn about unused variables
    php /var/www/html/extensions/CirrusSearch/maintenance/UpdateSearchIndexConfig.php
    php /var/www/html/extensions/CirrusSearch/maintenance/ForceSearchIndex.php --skipParse
    php /var/www/html/extensions/CirrusSearch/maintenance/ForceSearchIndex.php --skipLinks --indexOnSkip
fi
