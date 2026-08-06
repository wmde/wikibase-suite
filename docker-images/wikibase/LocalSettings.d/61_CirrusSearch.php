<?php

if (isset($elasticsearchHost)) {
  // https://www.mediawiki.org/wiki/Extension:CirrusSearch
  wfLoadExtension( 'CirrusSearch' );

  // See WikibaseCirrusSearch.php for further configuration
}
