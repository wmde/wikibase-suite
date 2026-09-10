<?php

declare( strict_types = 1 );

namespace MediaWiki\Extension\WikibaseBootstrap;

use MediaWiki\SpecialPage\SpecialPage;
use MediaWiki\Skin\Skin;
use ExtensionRegistry;

class SidebarHooks {
	/**
	 * Adds the bootstrap entry only while this Wikibase is still empty.
	 *
	 * This post-cache hook is intentional: eligibility changes when entities are
	 * created or deleted and therefore must not be stored in the sidebar cache.
	 *
	 * @param Skin $skin
	 * @param array<string, array<int, array<string, mixed>>> &$sidebar
	 */
	public static function onSidebarBeforeOutput( $skin, &$sidebar ): void {
		if ( !ExtensionRegistry::getInstance()->isLoaded( 'WikibaseSuite' ) ||
			!$skin->getUser()->isAllowed( 'bootstrapontology' ) ||
			!BootstrapService::newFromConfig()->isEligible()
		) {
			return;
		}

		$sidebar['wikibase-suite-sidebar'][] = [
			'text' => $skin->msg( 'ontologybootstrap' )->text(),
			'href' => SpecialPage::getTitleFor( 'OntologyBootstrap' )->getLocalURL(),
			'id' => 'n-ontology-bootstrap',
			'active' => false,
		];
	}
}
