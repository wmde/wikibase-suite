#!/usr/bin/env bash

set -euo pipefail

cloud_settings=/opt/wikibase-cloud/CloudSettings.php

until curl --silent --fail \
  'http://api.svc/backend/wiki/getWikiForDomain?domain=cloud1.wikibase.test' \
  >/dev/null; do
	echo 'Waiting for the Cloud fixture API…'
	sleep 1
done

install_tenant() {
	local domain="$1"
	local database="$2"
	local table_prefix="$3"
	local site_name="$4"

	mkdir -p "/tmp/${domain}"
	# The installer deliberately rejects an existing settings file. Install into
	# a disposable per-tenant path, then use CloudSettings.php for normal runtime
	# and schema updates below.
	# The generated LocalSettings.php is disposable. CloudSettings.php below
	# uses the restricted mwu_someuser account for normal runtime.
	WBS_DOMAIN="$domain" MW_CONFIG_FILE="/tmp/${domain}/LocalSettings.php" \
		php /var/www/html/maintenance/run.php install.php \
		--confpath "/tmp/${domain}" \
		--dbname "$database" \
		--dbprefix "${table_prefix}_" \
		--dbserver mysql.svc \
		--installdbuser root \
		--installdbpass cloud-root-password \
		--dbuser root \
		--dbpass cloud-root-password \
		--scriptpath /w \
		--server "http://${domain}:5440" \
		--lang en \
		--pass cloud-admin-password \
		"$site_name" CloudAdmin

	WBS_DOMAIN="$domain" php /var/www/html/maintenance/run.php \
		--conf "$cloud_settings" update.php --quick
}

install_tenant cloud1.wikibase.test mwdb_cloud1 mwt_cloud1 'Cloud POC One'
install_tenant cloud2.wikibase.test mwdb_cloud2 mwt_cloud2 'Cloud POC Two'
