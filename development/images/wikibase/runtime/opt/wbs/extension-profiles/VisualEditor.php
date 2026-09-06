<?php

// https://www.mediawiki.org/wiki/Extension:VisualEditor
## VisualEditor Extension
wfLoadExtension( 'VisualEditor' );

// VisualEditor uses this to find the Parsoid REST endpoint. Docs note
// this may need to be set explicitly in container/proxy setups, ref:
// https://www.mediawiki.org/wiki/Extension:VisualEditor
$wgVirtualRestConfig['modules']['parsoid'] = array(
	'url' => 'http://localhost' . $wgScriptPath . '/rest.php',
);
