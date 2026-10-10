<?php

// Invitation-only account creation is independent from ConfirmAccount and can
// be selected on its own.
wfLoadExtension( 'InviteSignup' );

$wgGroupPermissions['*']['createaccount'] = false;
$wgGroupPermissions['user']['createaccount'] = false;
$wgGroupPermissions['sysop']['invitesignup'] = true;
$wgISGroups = [ 'confirmed' ];
