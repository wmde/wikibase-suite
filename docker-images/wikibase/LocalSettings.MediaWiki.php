<?php

# JobRunner instance is assumed by default, so jobs on request is disabled
$wgJobRunRate = 0;

# File Uploads enabled by default
$wgEnableUploads = true;

# Logs
# TODO: Explore simply logging to stdout/stderr so these appear in Docker logs
$wgDebugLogGroups = array(
	'resourceloader' => '/var/log/mediawiki/mw.resourceloader.log',
	'exception' => '/var/log/mediawiki/mw.exception.log',
	'error' => '/var/log/mediawiki/mw.error.log',
	'fatal' => '/var/log/mediawiki/mw.fatal.log',
);
$wgDebugLogFile = '/var/log/mediawiki/mw.debug.log';

$wgArticlePath = "/wiki/$1";

# Disable anonymous write access by default while keeping anonymous read access.
$wgGroupPermissions['*']['edit'] = false;
$wgGroupPermissions['*']['createpage'] = false;
$wgGroupPermissions['*']['createtalk'] = false;
$wgGroupPermissions['*']['writeapi'] = false;
$wgGroupPermissions['*']['createaccount'] = false;
