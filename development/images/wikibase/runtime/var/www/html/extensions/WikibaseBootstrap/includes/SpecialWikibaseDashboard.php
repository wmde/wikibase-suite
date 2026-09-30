<?php

namespace MediaWiki\Extension\WikibaseBootstrap;

use SpecialPage;

class SpecialWikibaseDashboard extends SpecialPage {

	public function __construct() {
		parent::__construct( 'WikibaseDashboard' );
	}

	public function execute( $subPage ) {
		$this->setHeaders();
		$this->outputHeader();

		$output = $this->getOutput();

		// Placeholder banner
		$output->addHTML(
			'<div style="background: #eaecf0; border: 1px solid #a2a9b1; padding: 12px 16px; margin-bottom: 16px; border-radius: 2px;">' .
				'<strong>Placeholder:</strong> This dashboard is under construction.' .
			'</div>'
		);

		$output->addHTML(
			'<div style="display: flex; gap: 16px; align-items: flex-start;">' .

				'<table style="border-collapse: collapse; flex: 0 0 auto;">' .
					'<caption style="font-weight: bold; text-align: left; padding-bottom: 6px;">Your Wikibase Ontology</caption>' .
					'<tr>' .
						'<th style="border: 1px solid #a2a9b1; padding: 6px 12px; background: #f8f9fa;">Name</th>' .
						'<th style="border: 1px solid #a2a9b1; padding: 6px 12px; background: #f8f9fa;">Value</th>' .
					'</tr>' .
					'<tr>' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">Items</td>' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">' .
							'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">' .
								'<span>12</span>' .
								'<button class="mw-ui-button mw-ui-quiet" type="button">Add item</button>' .
							'</div>' .
						'</td>' .
					'</tr>' .
					'<tr>' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">Properties</td>' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">' .
							'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">' .
								'<span>34</span>' .
								'<button class="mw-ui-button mw-ui-quiet" type="button">Add property</button>' .
							'</div>' .
						'</td>' .
					'</tr>' .
					'<tr>' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">Truples</td>' .
						'<td style="border: 1px solid #a2a9b1; padding: 6px 12px;">' .
							'<div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">' .
								'<span>99.9%</span>' .
							'</div>' .
						'</td>' .
					'</tr>' .
				'</table>' .

				'<div style="border: 1px solid #a2a9b1; padding: 12px 16px; background: #f8f9fa; flex: 1 1 auto; max-width: 400px;">' .
					'<p><b>Help and resources:</b></p>' .
					'<ul>' .
						'<li>How to add data</li>' .
						'<li>Change the name and logo of your Wikibase</li>' .
						'<li>Configure a mail service</li>' .
						'<li>Add extensions</li>' .
						'<li>Activate Wikimedia logins</li>' .
					'</ul>' .
				'</div>' .

			'</div>'
		);

		// Button at the bottom
		$output->addHTML(
			'<div style="margin-top: 16px;">' .
				'<button class="mw-ui-button mw-ui-progressive" type="button">Import a set of properties</button>' .
			'</div>'
		);

		// $output->addModules( 'ext.wikibaseBootstrap.dashboard' );
		// $output->addHTML( '<div id="wikibase-dashboard-app">asdf</div>' );
	}

	public function getGroupName() {
		return 'wikibase';
	}
}