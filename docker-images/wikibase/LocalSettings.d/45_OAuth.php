<?php

## OAuth Extension
wfLoadExtension( 'OAuth' );
// TODO: OAuth is deprecating $wgMWOAuthSharedUserIDs and will eventually
// always use the shared-user-ID lookup. Using the local provider preserves
// WBS's previous single-wiki behavior. When the setting is removed upstream,
// remove $wgMWOAuthSharedUserIDs and verify whether the explicit local source
// is still necessary.
$wgMWOAuthSharedUserIDs = true;
$wgMWOAuthSharedUserSource = 'local';
$wgGroupPermissions['sysop']['mwoauthproposeconsumer'] = true;
$wgGroupPermissions['sysop']['mwoauthmanageconsumer'] = true;
$wgGroupPermissions['sysop']['mwoauthviewprivate'] = true;
$wgGroupPermissions['sysop']['mwoauthupdateownconsumer'] = true;
