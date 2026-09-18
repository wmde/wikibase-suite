<?php

declare( strict_types=1 );

/*
 * Cloud-owned MediaWiki configuration entry point.
 *
 * This file is selected with MW_CONFIG_FILE by the wikibase-cloud image. It
 * resolves the tenant before applying the Cloud policy so one shared MediaWiki
 * deployment can serve multiple request domains.
 */
require '/var/www/html/extensions/WBStackConfig/bootstrap.php';
require '/var/www/html/extensions/WBStackConfig/src/Settings/LocalSettings.php';
