<?php

// https://www.mediawiki.org/wiki/Extension:DiscussionTools
## DiscussionTools Extension
wfLoadExtension( 'DiscussionTools' );

// DiscussionTools relies on Parsoid-backed talk-page parsing/saving, and
// Linter requires Parsoid linting to be enabled.
$wgParsoidSettings = array_merge(
	$wgParsoidSettings ?? [],
	[
		'linting' => true,
	]
);
