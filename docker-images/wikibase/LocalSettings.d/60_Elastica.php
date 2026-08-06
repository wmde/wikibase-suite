<?php

if (isset($elasticsearchHost)) {
  // https://www.mediawiki.org/wiki/Extension:Elastica
  wfLoadExtension( 'Elastica' );

  // See WikibaseCirrusSearch.php for further configuration
}
