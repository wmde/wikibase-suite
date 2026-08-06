<?php

// https://www.mediawiki.org/wiki/Extension:WikibaseManifest

## WikibaseManifest Configuration
wfLoadExtension( 'WikibaseManifest' );

$quickstatements_url = getenv('QUICKSTATEMENTS_PUBLIC_URL');
if (!empty($quickstatements_url)) {
  $wgWbManifestExternalServiceMapping['quickstatements'] = $quickstatements_url;
}

$wdqs_endpoint_url = getenv('WDQS_PUBLIC_ENDPOINT_URL');
if (!empty($wdqs_endpoint_url)) {
  $wgWbManifestExternalServiceMapping['queryservice'] = $wdqs_endpoint_url;
}

$wdqs_frontend_url = getenv('WDQS_PUBLIC_FRONTEND_URL');
if (!empty($wdqs_frontend_url)) {
  $wgWbManifestExternalServiceMapping['queryservice_ui'] = $wdqs_frontend_url;
}
