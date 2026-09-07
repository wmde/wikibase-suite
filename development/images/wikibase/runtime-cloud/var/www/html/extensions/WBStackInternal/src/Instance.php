<?php

namespace WBStack\Internal;

use RuntimeException;

final class Instance {
	public static function domain(): string {
		$domain = $GLOBALS['wgWBStackInternalTenantDomain'] ?? null;

		if ( ( !is_string( $domain ) || $domain === '' ) && defined( 'WBSTACK_INFO_GLOBAL' ) ) {
			$legacyInfo = $GLOBALS[constant( 'WBSTACK_INFO_GLOBAL' )] ?? null;
			$domain = is_object( $legacyInfo ) ? ( $legacyInfo->requestDomain ?? null ) : null;
		}

		if ( !is_string( $domain ) || $domain === '' ) {
			$domain = getenv( 'WBS_DOMAIN' ) ?: ( $_SERVER['SERVER_NAME'] ?? '' );
		}

		if ( !is_string( $domain ) || $domain === '' ) {
			throw new RuntimeException( 'Unable to determine the WBStack tenant domain.' );
		}

		return strtolower( $domain );
	}
}

