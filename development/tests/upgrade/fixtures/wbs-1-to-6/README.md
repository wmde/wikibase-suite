# Configuration inherited by WBS 7

This fixture represents a WBS 7 installation that retained its configuration
from WBS 1, 2, 3, 4, 5, or 6. It uses the WBS-generated block from
`deploy@6.0.0:build/wikibase/LocalSettings.wbs.php`, which is byte-for-byte
identical in the latest audited WBS 1–5 deployment and image tags. The
matching loading section is recorded in `MigrateConfiguration.php`.

The MediaWiki-generated prefix and test instance values come from the existing
`wbs-7/LocalSettings.php` fixture. A job-rate override before the extension loop
and custom settings after the marker exercise preservation of user changes.
The suite uses the WBS 7 database fixture to test conversion of a historical
configuration retained by a WBS 7 installation.
