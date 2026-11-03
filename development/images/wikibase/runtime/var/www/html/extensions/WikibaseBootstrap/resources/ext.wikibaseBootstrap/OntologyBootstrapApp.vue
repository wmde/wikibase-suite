<template>
	<section class="ext-wikibase-bootstrap">
		<p>{{ config.summary }}</p>
		<cdx-message v-if="config.completed" type="success" class="ext-wikibase-bootstrap-completion">
			<strong>{{ message( 'ontologybootstrap-completion-created' ) }}</strong> {{ message( 'ontologybootstrap-completion-description', config.completed ) }}
		</cdx-message>
		<cdx-message v-if="config.resetCompleted" type="error" :inline="true" class="ext-wikibase-bootstrap-completion">
			<strong>{{ message( 'ontologybootstrap-reset-completed' ) }}</strong> {{ message( 'ontologybootstrap-reset-completion-description', config.resetCompleted ) }}
		</cdx-message>
		<section class="ext-wikibase-bootstrap-catalog">
			<h2>{{ message( 'ontologybootstrap-bundle-catalog-heading' ) }}</h2>
			<div class="ext-wikibase-bootstrap-catalog__details">
				<div>
					<h3>{{ bundle.title }}</h3>
					<p>{{ bundle.description }} <template v-if="bundle.sourceUrl">{{ message( 'ontologybootstrap-bundle-derived-from' ) }} <a :href="bundle.sourceUrl" rel="noopener noreferrer">{{ message( 'ontologybootstrap-bundle-source-label' ) }}</a>.</template></p>
					<p class="ext-wikibase-bootstrap-catalog__summary">{{ message( 'ontologybootstrap-bundle-property-count', bundle.propertyCount ) }}</p>
					<dl class="ext-wikibase-bootstrap-catalog__metadata">
						<div v-if="bundle.version">
							<dt>{{ message( 'ontologybootstrap-metadata-version' ) }}</dt>
							<dd>{{ bundle.version }}</dd>
						</div>
						<div v-if="bundle.license">
							<dt>{{ message( 'ontologybootstrap-metadata-license' ) }}</dt>
							<dd><a :href="bundle.license" rel="noopener noreferrer">{{ bundle.rights || bundle.license }}</a></dd>
						</div>
						<div v-if="bundle.publisher">
							<dt>{{ message( 'ontologybootstrap-metadata-publisher' ) }}</dt>
							<dd><a :href="bundle.publisher" rel="noopener noreferrer">{{ bundle.publisherLabel || bundle.publisher }}</a></dd>
						</div>
						<div v-if="bundle.contributors && bundle.contributors.length">
							<dt>{{ message( 'ontologybootstrap-metadata-contributors' ) }}</dt>
							<dd>{{ bundle.contributors.join( ', ' ) }}</dd>
						</div>
					</dl>
				</div>
				<div class="ext-wikibase-bootstrap-catalog__action">
					<div v-if="bundle.error" class="errorbox">{{ bundle.error }}</div>
					<span v-else-if="bundle.disabled">{{ message( 'ontologybootstrap-unavailable' ) }}</span>
					<cdx-button v-else action="progressive" weight="primary" @click="showApplyDialog = true">{{ message( 'ontologybootstrap-apply' ) }}</cdx-button>
				</div>
			</div>
		</section>
		<section v-if="config.reset" class="ext-wikibase-bootstrap-reset">
			<h2>{{ config.reset.summary }}</h2>
			<cdx-message v-if="config.reset.hasActiveItemStatements" type="warning">
				<p>{{ config.reset.itemStatementsError }}</p>
			</cdx-message>
			<template v-else-if="config.reset.canOfferReset">
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
			:open="showApplyDialog"
			:title="message( 'ontologybootstrap-apply-dialog-title', bundle.title )"
			:primary-action="{ label: message( 'ontologybootstrap-apply' ), actionType: 'progressive' }"
			:default-action="{ label: message( 'ontologybootstrap-cancel' ) }"
			use-close-button
			@update:open="updateDialog"
			@primary="applyBundle"
			@default="closeDialog"
		>
			<form ref="applyForm" method="post" :action="config.pageUrl">
				<input type="hidden" name="token" :value="config.token">
				<input type="hidden" name="action" value="apply">
				<p>{{ message( 'ontologybootstrap-apply-confirmation', bundle.propertyCount ) }}</p>
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
			config: mw.config.get( 'wgWikibaseBootstrap' ) || { bundle: {}, reset: null },
			resetConfirmation: '',
			showApplyDialog: false
		};
	},
	computed: {
		bundle() {
			return this.config.bundle || {};
		}
	},
	methods: {
		message( key, ...parameters ) {
			return mw.msg( key, ...parameters );
		},
		closeDialog() {
			this.showApplyDialog = false;
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
