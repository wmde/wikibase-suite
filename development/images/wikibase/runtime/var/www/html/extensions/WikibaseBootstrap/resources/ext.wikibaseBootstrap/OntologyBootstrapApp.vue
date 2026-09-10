<template>
	<section class="ext-wikibase-bootstrap">
		<p>{{ config.summary }}</p>
		<cdx-message v-if="config.completed" type="success" class="ext-wikibase-bootstrap-completion">
			<strong>Initial ontology created.</strong> {{ config.completed }} properties were created. Bootstrap setup is complete.
		</cdx-message>
		<cdx-message v-if="config.resetCompleted" type="error" :inline="true" class="ext-wikibase-bootstrap-completion">
			<strong>Wikibase entities deleted.</strong> {{ config.resetCompleted }} entities were deleted.
		</cdx-message>
		<section class="ext-wikibase-bootstrap-catalog">
			<h2>Bundled ontologies</h2>
			<table class="ext-wikibase-bootstrap-catalog__table" style="width: 100%; table-layout: fixed;">
		<colgroup><col class="ext-wikibase-bootstrap-catalog__ontology"><col><col class="ext-wikibase-bootstrap-catalog__action-column"></colgroup>
		<tbody>
			<template v-for="bundle in bundles" :key="bundle.key">
				<tr class="ext-wikibase-bootstrap-catalog__row">
					<th scope="row" class="ext-wikibase-bootstrap-catalog__ontology-cell">
						{{ bundle.title }}
						<div class="ext-wikibase-bootstrap-catalog__bundle-description">
							{{ bundle.description }} <template v-if="bundle.sourceUrl">Derived from the community-curated <a :href="bundle.sourceUrl" rel="noopener noreferrer">Wikibase bootstrap set</a>.</template>
						</div>
						<span class="ext-wikibase-bootstrap-catalog__summary">{{ bundle.propertyCount }} properties<br>{{ bundle.itemCount }} items/classes</span>
					</th>
					<td class="ext-wikibase-bootstrap-catalog__description">
						<dl class="ext-wikibase-bootstrap-catalog__metadata">
							<div v-if="bundle.version">
								<dt>Version</dt>
								<dd>{{ bundle.version }}</dd>
							</div>
							<div v-if="bundle.license">
								<dt>License</dt>
								<dd><a :href="bundle.license" rel="noopener noreferrer">{{ bundle.rights || bundle.license }}</a></dd>
							</div>
							<div v-if="bundle.publisher">
								<dt>Publisher</dt>
								<dd><a :href="bundle.publisher" rel="noopener noreferrer">{{ bundle.publisherLabel || bundle.publisher }}</a></dd>
							</div>
							<div v-if="bundle.contributors && bundle.contributors.length">
								<dt>Contributors</dt>
								<dd>{{ bundle.contributors.join( ', ' ) }}</dd>
							</div>
						</dl>
					</td>
					<td class="ext-wikibase-bootstrap-catalog__action">
						<div class="ext-wikibase-bootstrap-catalog__action-content">
							<div v-if="bundle.error" class="errorbox">{{ bundle.error }}</div>
							<span v-else-if="bundle.disabled">Unavailable</span>
							<cdx-button v-else action="progressive" weight="primary" @click="selectBundle( bundle )">Apply</cdx-button>
						</div>
					</td>
				</tr>
			</template>
		</tbody>
			</table>
		</section>
		<section v-if="config.reset" class="ext-wikibase-bootstrap-reset">
			<h2>{{ config.reset.summary }}</h2>
			<template v-if="config.reset.canOfferReset">
				<p>{{ config.reset.resetInvitation }}</p>
				<cdx-message type="error" class="ext-wikibase-bootstrap-reset__warning">
					<p>{{ config.reset.warning }}</p>
					<div v-if="config.reset.error" class="errorbox">{{ config.reset.error }}</div>
					<cdx-message v-if="config.reset.progress" type="error" :inline="true">{{ config.reset.progress }}</cdx-message>
					<div v-if="!config.reset.canReset" class="errorbox">{{ config.reset.permissionError }}</div>
					<form v-else method="post" :action="config.reset.pageUrl">
						<input type="hidden" name="token" :value="config.reset.token">
						<input type="hidden" name="action" value="reset">
						<div class="ext-wikibase-bootstrap-reset__confirmation">
							<label for="bootstrap-reset-confirm"><span>{{ config.reset.confirmationIntro }}</span><strong>{{ config.reset.confirmationText }}</strong></label>
							<cdx-text-input id="bootstrap-reset-confirm" v-model="resetConfirmation" name="confirmation"></cdx-text-input>
							<cdx-button type="submit" action="destructive" weight="primary" :disabled="resetConfirmation !== config.reset.confirmationText">{{ config.reset.submitLabel }}</cdx-button>
						</div>
					</form>
				</cdx-message>
			</template>
			<cdx-message v-else type="error" :inline="true">{{ config.reset.tooMany }}</cdx-message>
		</section>
		<cdx-dialog
			:open="pendingBundle !== null"
			:title="pendingBundle ? 'Apply ' + pendingBundle.title : 'Apply ontology'"
			:primary-action="{ label: 'Apply ontology', actionType: 'progressive' }"
			:default-action="{ label: 'Cancel' }"
			use-close-button
			@update:open="updateDialog"
			@primary="applyBundle"
			@default="closeDialog"
		>
			<form v-if="pendingBundle" ref="applyForm" method="post" :action="config.pageUrl">
				<input type="hidden" name="token" :value="config.token">
				<input type="hidden" name="action" value="apply">
				<input type="hidden" name="bundle" :value="pendingBundle.key">
				<p>This will create {{ pendingBundle.propertyCount }} properties in this empty Wikibase. It cannot be applied again without first deleting all Wikibase entities.</p>
			</form>
		</cdx-dialog>
	</section>
</template>

<script>
const { CdxButton, CdxDialog, CdxMessage, CdxTextInput } = require( '../../codex.js' );

module.exports = {
	name: 'OntologyBootstrapApp',
	components: { CdxButton, CdxDialog, CdxMessage, CdxTextInput },
	data() {
		return {
			config: mw.config.get( 'wgWikibaseBootstrap' ) || { bundles: [], reset: null },
			resetConfirmation: '',
			pendingBundle: null
		};
	},
	computed: {
		bundles() {
			return this.config.bundles || [];
		},
	},
	methods: {
		selectBundle( bundle ) {
			this.pendingBundle = bundle;
		},
		closeDialog() {
			this.pendingBundle = null;
		},
		updateDialog( open ) {
			if ( !open ) {
				this.closeDialog();
			}
		},
		applyBundle() {
			this.$refs.applyForm.submit();
		}
	}
};
</script>
