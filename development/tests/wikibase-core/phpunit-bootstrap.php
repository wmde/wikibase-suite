<?php

// MediaWiki normally loads these function files through autoload-dev. This
// image ships only the packages needed by PHPUnit and is built with --no-dev,
// so load the functions for this test process before MediaWiki's bootstrap.
$mediaWikiRoot = '/var/www/html';
require_once "$mediaWikiRoot/vendor/autoload.php";
require_once "$mediaWikiRoot/vendor/hamcrest/hamcrest-php/hamcrest/Hamcrest.php";
require_once "$mediaWikiRoot/vendor/wmde/hamcrest-html-matchers/src/functions.php";
require_once "$mediaWikiRoot/tests/phpunit/bootstrap.php";
