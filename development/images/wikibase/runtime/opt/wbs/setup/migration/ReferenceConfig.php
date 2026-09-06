<?php

# Effective Suite 8 configuration used when converting generated Suite 7
# configuration. It deliberately excludes user customizations.

if ( !defined( 'MEDIAWIKI' ) ) {
	exit;
}

require '/config/.wikibase-image/config-migration/InstanceSettings.php.tmp';
require '/opt/wbs/DefaultSettings.php';
