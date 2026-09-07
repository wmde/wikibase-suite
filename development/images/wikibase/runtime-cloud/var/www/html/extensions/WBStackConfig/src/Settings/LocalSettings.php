<?php
/**
 * This file includes core settings that are unlikely to need to change much.
 * These settings should also not be needed for the localization rebuild
 */

if ( !array_key_exists( WBSTACK_INFO_GLOBAL, $GLOBALS ) ) {
	// We shouldn't reach here as all entry points should create this GLOBAL..
    // However if new things get introduced we will end up here, and we will need another shim!
    echo 'LS.php not got wiki info.';
	die(1);
}

require_once __DIR__ . '/../loadAll.php';

/** @var \WBStack\Info\WBStackInfo $wikiInfo */
$wikiInfo = $GLOBALS[WBSTACK_INFO_GLOBAL];

// Define STDERR if it is not already. This is used for logging.
if ( !defined( 'STDERR' ) ) {
    define( 'STDERR', fopen( 'php://stderr', 'w' ) );
}

require_once __DIR__ . '/Localization.php';

// Define some conditions to switch behaviour on
$wwDomainSaysLocal = isset($_SERVER['SERVER_NAME']) && preg_match("/(\w\.localhost)/", $_SERVER['SERVER_NAME']) === 1;
$wwDomainIsMaintenance = $wikiInfo->requestDomain === 'maintenance';
$wwIsPhpUnit = isset( $maintClass ) && $maintClass === 'PHPUnitMaintClass';
$wwIsLocalisationRebuild = basename( $_SERVER['SCRIPT_NAME'] ) === 'rebuildLocalisationCache.php';
$wwLocalization = new Localization( $wgExtensionMessagesFiles, $wgMessagesDirs, $IP, $wwIsLocalisationRebuild );
$wwDockerCompose = getenv('WBSTACK_DOCKER_COMPOSE') === 'yes';

$wwUseMailgunExtension = true; // default for wbstack
if (getenv('MW_MAILGUN_DISABLED') === 'yes') {
    $wwUseMailgunExtension = false;
}

#######################################
## ---  Base MediaWiki Settings  --- ##
#######################################

// No error output or debugging in production
ini_set( 'display_errors', 0 );
ini_set( 'memory_limit', '256M' );
$wgShowExceptionDetails = false;
if( $wwDomainIsMaintenance || $wwIsPhpUnit || $wwIsLocalisationRebuild || $wwDomainSaysLocal ) {
    ini_set( 'display_errors', 1 );
    $wgShowExceptionDetails = true;
}

// Load Logging when not in phpunit or doing l10n rebuild
if ( !$wwIsPhpUnit && !$wwIsLocalisationRebuild ) {
    $wgMWLoggerDefaultSpi = [
        'class' => \WBStack\Logging\CustomSpi::class,
        'args' => [[
            'ignoreLevels' => [
                'debug',
                'info',
            ],
            'ignoreAllInGroup' => [
                'DBPerformance',
                'objectcache',// ideally want to show objectcache errors, but not warnings
            ],
            'logAllInGroup' => [
                'WBSTACK',
                'HttpError',
                'SpamBlacklistHit',
                'security',
                'exception-json',
                //'error',
                'fatal',
                'badpass',
                'badpass-priv',
                'api-warning',
            ],
            'logAllInGroupExceptDebug' => [
                //'Wikibase',
                'BlockManager',// we want info https://gerrit.wikimedia.org/g/mediawiki/core/+/916c0307a06e64b49d4b7f0340808a38b6d5b9a4/includes/block/BlockManager.php#426
            ],
        ]],
    ];
}

// Disable logging for local dev setup so it get's redirected to stderr and therefore can be viewed in the Kubernetes dashboard
if ( getenv('MW_LOG_TO_STDERR') === 'yes' ) {
    $wgMWLoggerDefaultSpi = [
        'class' => \WBStack\Logging\CustomSpi::class,
        'args' => [[
            'ignoreLevels' => [],
            'ignoreAllInGroup' => [],
            'logAllInGroup' => [],
            'logAllInGroupExceptDebug' => [],
        ]],
    ];
}

if ( $wwDockerCompose ) {
    $wgServer = "http://" . $wikiInfo->domain . ":" . getenv('MW_LOCAL_HOST_PORT');
} else {
    $wgServer = "https://" . $wikiInfo->domain;
}


$wgScriptPath = "/w";
$wgArticlePath = "/wiki/$1";

$wgDBname = $wikiInfo->wiki_db->name;
$wgDBprefix = $wikiInfo->wiki_db->prefix . '_';
$wgDBTableOptions = "ENGINE=InnoDB, DEFAULT CHARSET=binary";
$wgDBtype = 'mysql';
$wgDBserver = getenv('MW_DB_SERVER_MASTER');
$wgDBuser = $wikiInfo->wiki_db->user;
$wgDBpassword = $wikiInfo->wiki_db->password;

$wgDBservers = [
    [
        'host' => getenv('MW_DB_SERVER_MASTER'),
        'dbname' => $wgDBname,
        'user' => $wikiInfo->wiki_db->user,
        'password' => $wikiInfo->wiki_db->password,
        'type' => "mysql",
        'flags' => DBO_DEFAULT,
        'load' => 1,
    ],
];

// DO NOT add the replica server config if we are just running a non wiki maint script.
// For example schema generation or localization cache reload
// WBS_DOMAIN=maint php ./w/maintenance/update.php --schema sql.sql --quick
// As in these contexts there is often no replica.... and thus one would fail...
// Also: skip the config if host name is empty. Useful in case replication breaks and we want to disable it.
if( !$wwDomainIsMaintenance && !empty(getenv('MW_DB_SERVER_REPLICA'))){
    $wgDBservers[] = [
        'host' => getenv('MW_DB_SERVER_REPLICA'),
        'dbname' => $wgDBname,
        'user' => $wikiInfo->wiki_db->user,
        'password' => $wikiInfo->wiki_db->password,
        'type' => "mysql",
        'flags' => DBO_DEFAULT,
        'max lag' => 10,
        'load' => 100,
    ];
}

// Disable TransactionProfiler for masterConns on GET (T408101)
unset( $wgTrxProfilerLimits['GET']['masterConns'] );

// Limit expensive queries (T399804)
$wgMaxExecutionTimeForExpensiveQueries = 5_000;

// Jobs
# For now jobs will run in the requests, this obviously isn't the ideal solution and really
# there should be a job running service deployed...
# This was set to 2 as Andra experienced a backup of jobs. https://github.com/addshore/wbstack/issues/51
$wgJobRunRate = 2;

// Storage
// Compress revisions
$wgCompressRevisions = true;

// Notifications
$wgEnotifUserTalk = false;
$wgEnotifWatchlist = false;

// Files
// $wgUseImageMagick Is needed so that Score auto trims rendered musical notations
$wgUseImageMagick = true;
$wgEnableUploads = false;
$wgAllowCopyUploads = false;
$wgUseInstantCommons = true;

// Workaround for T413870
$wgTiffThumbnailType = array( 'jpg', 'image/jpeg' );

$wgFileExtensions = array_merge( $wgFileExtensions,
    array( 'doc', 'xls', 'mpp', 'pdf', 'ppt', 'xlsx', 'jpg',
        'tiff', 'odt', 'odg', 'ods', 'odp', 'svg'
    )
);
//$wgFileExtensions[] = 'djvu';

$wgSitename = $wikiInfo->sitename;

// Logos
$wgLogos = [
    "1x" => $wikiInfo->getSetting('wgLogo'),
];
if( $wgLogos["1x"] === null ) {
    // Fallback to the mediawiki logo without the wgLogo overlay
    $wgLogos = [
        "1x" => "/w/extensions/WBStackConfig/resources/assets/wikibase_cloud.svg",
    ];
}

// Favicon
$wgFavicon = $wikiInfo->getSetting('wgFavicon');
if( $wgFavicon === null ) {
    // Default from install, but maybe we want to change this?
    $wgFavicon = "/favicon.ico";
}

// Readonly: null, or a string message for readonly mode & reason.
// Always writable via CLI
$wgReadOnly = ( PHP_SAPI === 'cli' ) ? false : $wikiInfo->getSetting('wgReadOnly');

// https://www.mediawiki.org/wiki/Manual:$wgFooterIcons
// Add the custom powered by icons....
// TODO the Wikibase one should be in Wikibase..
$wgFooterIcons = [
    "copyright" => [
        "copyright" => [], // placeholder for the built in copyright icon
    ],
    "poweredby" => [
        "mediawiki" => [
            "src" => "/w/extensions/WBStackConfig/resources/assets/poweredby_mediawiki.svg",
            "url" => "https://www.mediawiki.org/",
            "alt" => "Powered by MediaWiki",
        ],
        "wikibase" => [
            "src" => "/w/extensions/WBStackConfig/resources/assets/poweredby_wikibase.svg",
            "url" => "https://wikibase.cloud/",
            "alt" => "Powered by Wikibase",
        ],
        "wbstack" => [
            "src" => "/w/extensions/WBStackConfig/resources/assets/basedon_wbstack.svg",
            "url" => "https://wbstack.com/",
            "alt" => "Based on WBStack",
        ],
    ],
];

$wgHooks['SkinAddFooterLinks'][] = function ( Skin $skin, string $key, array &$footerlinks ) {
    if ( $key === 'places' ) {
        $addFooterLink = function ( string $label, string $url ) use ( &$footerlinks ) {
            $key = strtolower( str_replace( ' ', '-', $label ) );
            $footerlinks[ $key ] = MediaWiki\Html\Html::element(
                'a',
                [
                    'href' => $url,
                    'target' => '_blank',
                    'rel' => 'noopener noreferrer'
                ],
                $label
            );
        };
        // Display order and styling for these links are configured in "../Styling/footer-links.css"
        $addFooterLink( 'Copyrights', '/wiki/Project:Copyrights' );
        $addFooterLink( 'Wikibase Cloud Privacy Policy', 'https://www.wikibase.cloud/privacy-policy' );
        $addFooterLink( 'DSA Information', 'https://www.wikibase.cloud/dsa-info' );
        $addFooterLink( 'Report illegal content', 'https://wikibase.cloud/complaint' );
    }
};

// Custom CSS styling
$wgResourceModules[ 'wbstack.styling' ] = array(
    'styles' => [ 'footer-badges.css', 'footer-links.css' ],
    'localBasePath' => dirname( __DIR__ ) . '/Styling',
    'remoteBasePath' => "$wgScriptPath/extensions/WBStackConfig/src/Styling"
);
$wgHooks[ 'BeforePageDisplay' ][] = 'onBeforePageDisplay';
function onBeforePageDisplay( &$out, &$skin ) {
    $out->addModuleStyles( [ 'wbstack.styling' ] );
}

// Language
// TODO this should be settings from the main platform
$wgLanguageCode = "en";

// Email
$wgEnableEmail = true;
$wgEnableUserEmail = false;
$wgAllowHTMLEmail = true;
// enable email authentication (confirmation) for this wiki
$wgEmailAuthentication = true;
// require email authentication
$wgEmailConfirmToEdit = true;

$wgEmergencyContact = 'noreply@' . getenv('MW_EMAIL_DOMAIN'); //T372617
$wgPasswordSender = 'noreply@' . getenv('MW_EMAIL_DOMAIN');
$wgNoReplyAddress = 'noreply@' . getenv('MW_EMAIL_DOMAIN');

// SMTP
if (getenv('MW_SMTP_ENABLED') === 'yes') {
    $wgSMTP = [
        'host'     => getenv('MW_SMTP_HOST'),     // could also be an IP address. Where the SMTP server is located. If using SSL or TLS, add the prefix "ssl://" or "tls://".
        'IDHost'   => getenv('MW_EMAIL_DOMAIN'),  // Generally this will be the domain name of your website (aka mywiki.org)
        'port'     => getenv('MW_SMTP_PORT'),     // Port to use when connecting to the SMTP server
        'auth'     => getenv('MW_SMTP_AUTH') == "true",     // Should we use SMTP authentication (true or false)
        'username' => getenv('MW_SMTP_USERNAME'), // Username to use for SMTP authentication (if being used)
        'password' => getenv('MW_SMTP_PASSWORD')  // Password to use for SMTP authentication (if being used)
    ];
}

## Keys
$wgSecretKey = $wikiInfo->getSetting('wgSecretKey');
$wgAuthenticationTokenVersion = "1";

$wgOAuth2PrivateKey = $wikiInfo->getSetting('wgOAuth2PrivateKey');
$wgOAuth2PublicKey = $wikiInfo->getSetting('wgOAuth2PublicKey');

// So we are uniform, have the project namespace as Project
$wgMetaNamespace = 'Project';
// Needed so that Wikibase items appear in Special:Random and are counted as content pages.
// TODO this should be a Wikibase default behaviour?
$wgContentNamespaces[] = 120;

// TODO sort out directories and stuff...?
// $wgCacheDirectory is needed at least for the l10n rebuild
$wgCacheDirectory = '/tmp/mw-cache';
//$wgUploadDirectory = "{$wgBaseDirectory}/images/docker/{$dockerDb}";
//$wgUploadPath = "{$wgScriptPath}/images/docker/{$dockerDb}";
//$wgTmpDirectory = "{$wgUploadDirectory}/tmp";

#######################################
## ---   Default Permissions     --- ##
#######################################

# Disallow anon editing for now
$wgGroupPermissions['*']['edit'] = false;
$wgGroupPermissions['*']['createpage'] = false;

# Stop crats from being able to interact with the platform group
$wgGroupPermissions['bureaucrat']['userrights'] = false;
$wgAddGroups['bureaucrat'][] = 'sysop';
$wgAddGroups['bureaucrat'][] = 'bureaucrat';
$wgAddGroups['bureaucrat'][] = 'bot';
$wgAddGroups['bureaucrat'][] = 'emailconfirmed';
$wgRemoveGroups['bureaucrat'][] = 'sysop';
$wgRemoveGroups['bureaucrat'][] = 'bureaucrat';
$wgRemoveGroups['bureaucrat'][] = 'bot';
$wgRemoveGroups['bureaucrat'][] = 'emailconfirmed';

# Remove the predefined interface-admin group
unset( $wgGroupPermissions['interface-admin'] );
unset( $wgRevokePermissions['interface-admin'] );
unset( $wgAddGroups['interface-admin'] );
unset( $wgRemoveGroups['interface-admin'] );
unset( $wgGroupsAddToSelf['interface-admin'] );
unset( $wgGroupsRemoveFromSelf['interface-admin'] );

# Allow crats to editsitecss
$wgGroupPermissions['bureaucrat']['editsitecss'] = true;

$wgGroupPermissions['user']['editmyusercss'] = true;
$wgGroupPermissions['user']['editmyuserjs'] = true;

$wgAllowUserCss = true;
$wgAllowUserJs = true;

# Allow emailconfirmed to skip captcha
$wgAutopromote['emailconfirmed'] = APCOND_EMAILCONFIRMED;
$wgGroupPermissions['emailconfirmed']['skipcaptcha'] = true;

# Oauth
$wgGroupPermissions['sysop']['mwoauthproposeconsumer'] = true;
$wgGroupPermissions['sysop']['mwoauthmanageconsumer'] = true;
$wgGroupPermissions['sysop']['mwoauthviewprivate'] = true;
$wgGroupPermissions['sysop']['mwoauthupdateownconsumer'] = true;
$wgGroupPermissions['platform']['mwoauthproposeconsumer'] = true;
$wgGroupPermissions['platform']['mwoauthmanageconsumer'] = true;
$wgGroupPermissions['platform']['mwoauthviewprivate'] = true;
$wgGroupPermissions['platform']['mwoauthupdateownconsumer'] = true;

#######################################
## ---          Skins            --- ##
#######################################
wfLoadSkin( 'Vector' );
wfLoadSkin( 'MinervaNeue' );

// Cloud deliberately ignores the per-wiki legacy skin setting in this POC.
// Vector 2022 is the sole supported site-default skin during the MediaWiki
// 1.46 migration. Minerva remains loaded only for MobileFrontend below.
$wgDefaultSkin = 'vector-2022';

#######################################
## ---        Extensions         --- ##
#######################################
wfLoadExtension( 'WBStackConfig' );

wfLoadExtension( 'SyntaxHighlight_GeSHi' );
wfLoadExtension( 'RevisionSlider' );
wfLoadExtension( 'TorBlock' );
wfLoadExtension( 'Nuke' );
wfLoadExtension( 'EntitySchema' );
wfLoadExtension( 'UniversalLanguageSelector' );
wfLoadExtension( 'cldr' );
# TODO load again once there is a fix for localization cache reload without DBhttps://phabricator.wikimedia.org/T237148
#wfLoadExtension( 'Gadgets' );
wfLoadExtension( 'OAuth' );
$wgMWOAuthSharedUserIDs = true;
$wgMWOAuthSharedUserSource = 'local';
$wgVirtualDomainsMapping['virtual-oauth'] = [ 'db' => false ];
wfLoadExtension( 'JsonConfig' );
wfLoadExtension( 'Math' );
wfLoadExtension( 'Kartographer' );
wfLoadExtension( 'PageImages' );
wfLoadExtension( 'TextExtracts' );
wfLoadExtension( 'Scribunto' );
wfLoadExtension( 'Cite' );
wfLoadExtension( 'TemplateSandbox' );
wfLoadExtension( 'WikiEditor' );
wfLoadExtension( 'CodeEditor' );
wfLoadExtension( 'CodeMirror' );
wfLoadExtension( 'SecureLinkFixer' );
wfLoadExtension( 'Echo' );
wfLoadExtension( 'Thanks' );
wfLoadExtension( 'Poem' );
wfLoadExtension( 'TemplateData' );
wfLoadExtension( 'AdvancedSearch' );
wfLoadExtension( 'ParserFunctions' );
wfLoadExtension( 'EmbedVideo' );
wfLoadExtension( 'DeleteBatch' );
wfLoadExtension( 'MultimediaViewer' );
wfLoadExtension( 'WikiHiero' );

# ConfirmAccount (only loaded when the setting is on)
if( $wikiInfo->getSetting('wwExtEnableConfirmAccount') ) {
    wfLoadExtension( 'ConfirmAccount' );

    $wgMakeUserPageFromBio = false;
    $wgAutoWelcomeNewUsers = false;
    $wgConfirmAccountCaptchas = true;
    $wgConfirmAccountRequestFormItems = [
        'UserName'        => [ 'enabled' => true ],
        'RealName'        => [ 'enabled' => false ],
        'Biography'       => [ 'enabled' => false, 'minWords' => 50 ],
        'AreasOfInterest' => [ 'enabled' => false ],
        'CV'              => [ 'enabled' => false ],
        'Notes'           => [ 'enabled' => true ],
        'Links'           => [ 'enabled' => false ],
        'TermsOfService'  => [ 'enabled' => false ],
    ];
    $wgGroupPermissions['bureaucrat']['confirmaccount-notify'] = true;
    $wgGroupPermissions['bureaucrat']['requestips'] = false;
    $wgGroupPermissions['bureaucrat']['lookupcredentials'] = false;
    $wgGroupPermissions['*']['requestips'] = false;
    $wgGroupPermissions['*']['lookupcredentials'] = false;
    $wgHooks['SkinTemplateNavigation::Universal'][] = 'onSkinTemplateNavigationUniversal';
    function onSkinTemplateNavigationUniversal( SkinTemplate $skin, array &$links ) {
        // Add a link to Special:RequestAccount if a link exists for login
        if ( isset( $links['user-menu']['login'] ) || isset( $links['user-menu']['anonlogin'] ) ) {
            $links['user-menu']['createaccount'] = array(
                'text' => wfMessage( 'requestaccount' )->text(),
                'href' => SpecialPage::getTitleFor( 'RequestAccount' )->getFullURL()
            );
        }
        return true;
    }
    // fix known issue for mediawiki newer than 1.35 to prevent unapproved creation
    $wgGroupPermissions['*']['createaccount'] = false;
    $wgGroupPermissions['bureaucrat']['createaccount'] = true;
}

# InviteSignup (only loaded when the setting is on)
if( $wikiInfo->getSetting('wwExtEnableInviteSignup') ) {
    wfLoadExtension( 'InviteSignup' );
    # Restrict account creation
    $wgGroupPermissions['*']['createaccount'] = false;
    $wgGroupPermissions['user']['createaccount'] = false;
    # Allow sysops to review the queue
    $wgGroupPermissions['sysop']['invitesignup'] = true;
    # Suggest / add invited people to confirmed
    $wgISGroups = [ 'confirmed' ];
}

# WikibaseInWikitext
wfLoadExtension( 'WikibaseInWikitext' ); // custom wbstack extension
$wgWikibaseInWikitextSparqlDefaultUi = $wgServer . '/query';

# WikibaseEdtf
wfLoadExtension( 'WikibaseEdtf' );

# ThatSrc: Only load it when manually enabled on a wiki https://github.com/wbstack/mediawiki/issues/57#issuecomment-827116895
if( $wikiInfo->getSetting('nyurikThatSrcEnable') ) {
    wfLoadExtension( 'ThatSrc' );
}

# TwoColConflict
wfLoadExtension( 'TwoColConflict' );
// Enable the feature by default
$wgTwoColConflictBetaFeature = false;

# VisualEditor
wfLoadExtension( 'VisualEditor' );
wfLoadExtension( 'Parsoid', "$IP/vendor/wikimedia/parsoid/extension.json" );
$wgVirtualRestConfig[ 'modules' ][ 'parsoid' ] = array(
    'url' => $wgServer . $wgScriptPath . '/rest.php'
);
$wgDefaultUserOptions[ 'visualeditor-editor' ] = 'visualeditor';

# StopForumSpam
wfLoadExtension( 'StopForumSpam' );

# SpamBlacklist
wfLoadExtension( 'SpamBlacklist' );
$wgBlacklistSettings = [
	'spam' => [
		'files' => [
			"https://meta.wikimedia.org/w/index.php?title=Spam_blacklist&action=raw&sb_ver=1",
			"https://en.wikipedia.org/w/index.php?title=MediaWiki:Spam-blacklist&action=raw&sb_ver=1",
			"https://raw.githubusercontent.com/wbstack/mediawiki-spam-lists/main/spam_list",
		],
	],
    'email' => [
	    'files' => [
			"https://raw.githubusercontent.com/wbstack/mediawiki-spam-lists/main/email_list",
		],
    ],
];

# Check IPs at https://whatismyipaddress.com/blacklist-check if they are troublesome
$wgEnableDnsBlacklist = !$wwDockerCompose;
$wgDnsBlacklistUrls =
    [
        'combined.abuse.ch.',
        'xbl.spamhaus.org.',
        'cbl.abuseat.org.',
        'http.dnsbl.sorbs.net.',
        'opm.tornevall.org.',
        'all.s5h.net.',
        'dnsbl.dronebl.org.',
    ];

# ConfirmEdit

# QuestyCaptcha
$wwUseQuestyCaptcha = $wikiInfo->getSetting('wwUseQuestyCaptcha');
if ($wwUseQuestyCaptcha) {
    $wwLocalization->loadExtension( 'ConfirmEdit/ReCaptchaNoCaptcha' );
    wfLoadExtensions([ 'ConfirmEdit', 'ConfirmEdit/QuestyCaptcha' ]);
    $wgCaptchaClass = 'MediaWiki\\Extension\\ConfirmEdit\\QuestyCaptcha\\QuestyCaptcha';
    $wgCaptchaQuestions = json_decode($wikiInfo->getSetting('wwCaptchaQuestions'), true);
} else {
    $wwLocalization->loadExtension( 'ConfirmEdit/QuestyCaptcha' );
    wfLoadExtensions([ 'ConfirmEdit', 'ConfirmEdit/ReCaptchaNoCaptcha' ]);
    $wgCaptchaClass = 'MediaWiki\\Extension\\ConfirmEdit\\ReCaptchaNoCaptcha\\ReCaptchaNoCaptcha';
    $wgReCaptchaSendRemoteIP = true;
    $wgReCaptchaSiteKey = getenv('MW_RECAPTCHA_SITEKEY');
    $wgReCaptchaSecretKey = getenv('MW_RECAPTCHA_SECRETKEY');
}

# Mailgun
if ($wwUseMailgunExtension) {
    wfLoadExtension( 'Mailgun' );
    $wgMailgunAPIKey = getenv('MW_MAILGUN_API_KEY');
    $wgMailgunDomain = getenv('MW_MAILGUN_DOMAIN');
    // Example Endpoint "https://api.mailgun.net"
    $wgMailgunEndpoint = getenv('MW_MAILGUN_ENDPOINT');
}

# MobileFrontend
wfLoadExtension( 'MobileFrontend' );
$wgMFDefaultSkinClass = 'SkinMinerva';

# Score
wfLoadExtension( 'Score' );
$wgMusicalNotationEnableWikibaseDataType = true;

#######################################
## ---          Wikibase         --- ##
#######################################
wfLoadExtension( 'WikibaseRepository', "$IP/extensions/Wikibase/extension-repo.json" );
require_once "$IP/extensions/Wikibase/repo/ExampleSettings.php";
wfLoadExtension( 'WikibaseClient', "$IP/extensions/Wikibase/extension-client.json" );
require_once "$IP/extensions/Wikibase/client/ExampleSettings.php";

$wwWikibaseStringLengthString = $wikiInfo->getSetting('wwWikibaseStringLengthMonolingualText');
if($wwWikibaseStringLengthString) {
    $wgWBRepoSettings['string-limits']['VT:string']['length'] = (int)$wwWikibaseStringLengthString;
}
$wwWikibaseStringLengthMonolingualText = $wikiInfo->getSetting('wwWikibaseStringLengthMonolingualText');
if($wwWikibaseStringLengthMonolingualText) {
    $wgWBRepoSettings['string-limits']['VT:monolingualtext']['length'] = (int)$wwWikibaseStringLengthMonolingualText;
}
$wwWikibaseStringLengthMultilang = $wikiInfo->getSetting('wwWikibaseStringLengthMultilang');
if($wwWikibaseStringLengthMultilang) {
    $wgWBRepoSettings['string-limits']['multilang']['length'] = (int)$wwWikibaseStringLengthMultilang;
}

$wgWBClientSettings['siteGlobalID'] = $wgDBname;
$wgWBClientSettings['repoScriptPath'] = '/w';
$wgWBClientSettings['repoArticlePath'] = '/wiki/$1';
$wgWBClientSettings['siteGroup'] = null;
$wgWBClientSettings['thisWikiIsTheRepo'] = true;
$wgWBClientSettings['repoUrl'] = $GLOBALS['wgServer'];
$wgWBClientSettings['repoSiteName'] = $GLOBALS['wgSitename'];

$wgWBRepoSettings['localClientDatabases'] = [
    $wgDBname => $wgDBname."-".$wgDBprefix
];

$localConceptBaseUri = 'https://' . $wikiInfo->domain . '/entity/';

$wgWBRepoSettings['entitySources'] = [
    'local' => 
    [
      'entityNamespaces' => 
      [
        'item' => '120/main',
        'property' => '122/main',
      ],
      'repoDatabase' => false,
      'baseUri' => $localConceptBaseUri,
      'rdfNodeNamespacePrefix' => 'wd',
      'rdfPredicateNamespacePrefix' => '',
      'interwikiPrefix' => '',
    ],
];
  
$wgWBClientSettings['entitySources'] = [
    'local' => 
    [
      'entityNamespaces' => 
      [
        'item' => '120/main',
        'property' => '122/main',
      ],
      'repoDatabase' => false,
      'baseUri' => $localConceptBaseUri,
      'rdfNodeNamespacePrefix' => 'wd',
      'rdfPredicateNamespacePrefix' => '',
      'interwikiPrefix' => '',
    ],
];

// TODO below setting will be empty by default in the future and we could remove them
$wgWBRepoSettings['siteLinkGroups'] = [];
// TODO below setting will be empty by default in the future and we could remove them
$wgWBRepoSettings['specialSiteLinkGroups'] = [];

// see https://phabricator.wikimedia.org/T342001
$wgWBRepoSettings['dataRightsUrl'] = '';
$wgWBRepoSettings['dataRightsText'] = '';

// Until we can scale redis memory we don't want to do this - https://github.com/addshore/wbstack/issues/37
$wgWBRepoSettings['sharedCacheType'] = CACHE_NONE;

// Enable mul language code
$wgWBRepoSettings['enableMulLanguageCode'] = true;

# WikibaseLexeme, By default not enabled, enabled in WikiInfo-maint.json
if( $wikiInfo->getSetting('wwExtEnableWikibaseLexeme') ) {
    wfLoadExtension( 'WikibaseLexeme' );
    $wgLexemeEnableDataTransclusion = true;

    $wgWBRepoSettings['entitySources']['local']['entityNamespaces']['lexeme'] = '146/main';
    $wgWBClientSettings['entitySources']['local']['entityNamespaces']['lexeme'] = '146/main';
}
# Federated Properties, By default not enabled, not enabled in maint mode
if( $wikiInfo->getSetting('wikibaseFedPropsEnable') ) {
    // This will use wikidata.org by default
    $wgWBRepoSettings['federatedPropertiesEnabled'] = true;
}

if ( $wwDockerCompose === true ) {
    # Grant local users admin-like privileges
    $wgAddGroups['user'][] = 'emailconfirmed';
    $wgAddGroups['user'][] = 'sysop';

    # Do not force local users to verify their email account
    $wgEmailConfirmToEdit = false;

    # Do not force local users to complete a captcha
    $wgGroupPermissions['*']['skipcaptcha'] = true;

    # Disable captchas entirely
    $wgCaptchaTriggers = [];
    $wgConfirmAccountCaptchas = false;
}

# WikibaseManifest
wfLoadExtension( 'WikibaseManifest' );
$wgWbManifestExternalServiceMapping = [
    'queryservice_ui' => $wgServer . '/query',
    'queryservice' => $wgServer . '/query/sparql',
    'quickstatements' => $wgServer . '/tools/quickstatements',
];
if( $wikiInfo->getSetting('wikibaseManifestEquivEntities') ) {
    $wwEquivEntities = json_decode( $wikiInfo->getSetting('wikibaseManifestEquivEntities'), true );
    if ( is_array( $wwEquivEntities ) ) {
        $wgWbManifestWikidataEntityMapping = $wwEquivEntities;
        // Wikibase
        if ( array_key_exists( 'properties', $wwEquivEntities ) && array_key_exists( 'P1630', $wwEquivEntities['properties'] ) ) {
            $wgWBRepoSettings['formatterUrlProperty'] = $wwEquivEntities['properties']['P1630'];
        }
        if ( array_key_exists( 'properties', $wwEquivEntities ) && array_key_exists( 'P1921', $wwEquivEntities['properties'] ) ) {
            $wgWBRepoSettings['canonicalUriProperty'] = $wwEquivEntities['properties']['P1921'];
        }
        // WikibaseLexeme
        if ( array_key_exists( 'properties', $wwEquivEntities ) && array_key_exists( 'P305', $wwEquivEntities['properties'] ) ) {
            $wgLexemeLanguageCodePropertyId = $wwEquivEntities['properties']['P305'];
        }
    }
}

// ElasticSearch extension loading
// Allow maintainance scripts to enter this for the localization cache to be built
if ( $wikiInfo->getSetting( 'wwExtEnableElasticSearch' ) ) {
    wfLoadExtension( 'Elastica' );
    wfLoadExtension( 'CirrusSearch' );
    wfLoadExtension( 'WikibaseCirrusSearch' );

    $wgWBRepoSettings['searchIndexTypes'] = [
        'string', 'external-id', 'url', 'wikibase-item', 'wikibase-property'
    ];

    // If Wikibase Lexemes are enabled, enable lexeme cirrus search
    if ( $wikiInfo->getSetting('wwExtEnableWikibaseLexeme') ) {
        wfLoadExtension( 'WikibaseLexemeCirrusSearch' );

        $wgLexemeUseCirrus = true;

        // So that Lexemes are indexed in the content index
        $wgContentNamespaces[] = 146;

        // Add lexeme searchIndexTypes
        $wgWBRepoSettings['searchIndexTypes'][] = 'wikibase-lexeme';
        $wgWBRepoSettings['searchIndexTypes'][] = 'wikibase-form';
        $wgWBRepoSettings['searchIndexTypes'][] = 'wikibase-sense';
    }

    // prepends indices with database name
    $wgCirrusSearchIndexBaseName = getenv( 'MW_CIRRUSSEARCH_INDEX_BASE_NAME' ) ?: $wgDBname;

    if ( getenv( 'MW_CIRRUSSEARCH_PREFIX_IDS' ) === 'yes' ) {
        $wgCirrusSearchPrefixIds = true;
    }

    $wgSearchType = 'CirrusSearch';
    $wgCirrusSearchDefaultCluster = 'default';
    
    // T308115
    $wgCirrusSearchShardCount = [ 'content' => 1, 'general' => 1 ];

    // T350404
    $wgCirrusSearchReplicas = "0-1";

    // T309379
    $wgCirrusSearchEnableArchive = false;
    $wgCirrusSearchPrivateClusters = [ 'non-existing-cluster' ];

    // T312908
    $wgEntitySchemaShExSimpleUrl = 'https://shex-simple.toolforge.org/wikidata/packages/shex-webapp/doc/shex-simple.html';

    function getElasticClusterConfig( string $prefix ) {
        $config = [
            'host' => getenv( $prefix . 'HOST' ),
            'port' => getenv( $prefix . 'PORT' )
        ];
        return [ $config ];
    }

    if ( getenv( 'MW_ELASTICSEARCH_HOST' ) ) {
        $wgCirrusSearchClusters = [
            'default' => [
                [
                    'host' => getenv('MW_ELASTICSEARCH_HOST'),
                    'port' => getenv('MW_ELASTICSEARCH_PORT')
                ],
            ]
        ];
    } else {
        $wgCirrusSearchClusters = [
            'default' => getElasticClusterConfig( 'MW_DEFAULT_ELASTICSEARCH_' )
        ];
        if ( getenv( 'MW_WRITE_ONLY_ELASTICSEARCH_HOST' ) ) {
            $wgCirrusSearchClusters[ 'write-only' ] = getElasticClusterConfig( 'MW_WRITE_ONLY_ELASTICSEARCH_' );
        }
    }


    $wgWBCSUseCirrus = true;
    $wgWBCSElasticErrorFailSilently = true;
}

// Mitigation pre 1.43.9 Security Release
// See: T430272/T422244
$wgRevokePermissions['*']['importupload'] = true;
$wgRevokePermissions['*']['import'] = true;


#######################################
## ---  l10n rebuild and beyond  --- ##
#######################################
// Skip some things when in l10n rebuild, as they complicate things.
// TODO perhaps change this so that the rebuildLocalisationCache.php passes in an ENV var to block loading the extra settings instead of detecting?

// Disable any chance of localization cache updates during web requests
$wgLocalisationCacheConf['manualRecache'] = true;

// $wgCacheDirectory setting must also be valid for the l10n cache to land on disk

if( !$wwIsLocalisationRebuild ) {
    // Only load cache settings (redis db etc) when not doing a l10n rebuild
    require_once __DIR__ . '/ProductionCache.php';

    // If we have internal settings, and have been told to load them, then load them...
    if( getenv('WBSTACK_LOAD_MW_INTERNAL') === 'yes' && file_exists( __DIR__ . '/../loadInternal.php' ) ) {
        require_once __DIR__ . '/../loadInternal.php';
    } else {
        // Code for ONLY the public mw services
        $wgReservedUsernames = array_merge(
            $wgReservedUsernames,
            [
                // TODO should this be a constant
                'PlatformReservedUser',
            ]
        );
    }
}

require_once __DIR__ . '/Hooks.php';
