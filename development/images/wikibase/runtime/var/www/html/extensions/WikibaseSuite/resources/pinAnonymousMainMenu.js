/* global HTMLElement, MutationObserver, document */

// Temporary workaround for Vector 2022 not persisting anonymous main-menu pinning:
// https://phabricator.wikimedia.org/T366999
// Remove this once the upstream Vector fix is released in a supported MediaWiki version.
( function () {
	const pinMainMenu = () => {
		const pinButton = document.querySelector(
			'[data-event-name="pinnable-header.vector-main-menu.pin"]'
		);
		if ( !pinButton ) {
			return false;
		}

		pinButton.click();
		// Vector focuses the newly visible "hide" button after a user toggles pinning.
		// This pin is automatic, so leave the page with its normal initial focus instead.
		if ( document.activeElement instanceof HTMLElement ) {
			document.activeElement.blur();
		}
		return true;
	};

	if ( document.documentElement.classList.contains( 'vector-animations-ready' ) ) {
		pinMainMenu();
		return;
	}

	const observer = new MutationObserver( () => {
		if ( document.documentElement.classList.contains( 'vector-animations-ready' ) ) {
			pinMainMenu();
			observer.disconnect();
		}
	} );
	observer.observe( document.documentElement, {
		attributes: true,
		attributeFilter: [ 'class' ]
	} );
}() );
