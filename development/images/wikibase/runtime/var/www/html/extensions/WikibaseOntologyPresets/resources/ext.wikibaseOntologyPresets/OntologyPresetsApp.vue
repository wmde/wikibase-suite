<template>
	<section class="ext-wikibase-ontology-presets">
		<p>{{ config.summary }}</p>
		<cdx-message v-if="config.completed" type="success" class="ext-wikibase-ontology-presets-completion">
			<strong>{{ message( 'ontologypresets-completion-description', config.completed ) }}</strong> <a :href="config.propertiesUrl">{{ message( 'ontologypresets-view-all-properties' ) }}</a>
		</cdx-message>
		<section class="ext-wikibase-ontology-presets-catalog">
			<h2>{{ message( config.completed ? 'ontologypresets-applied-heading' : 'ontologypresets-catalog-heading' ) }}</h2>
			<div class="ext-wikibase-ontology-presets-catalog__details">
				<div class="ext-wikibase-ontology-presets-catalog__heading">
					<h3>{{ preset.title }}</h3>
					<div class="ext-wikibase-ontology-presets-catalog__action">
						<div v-if="preset.error" class="errorbox">{{ preset.error }}</div>
						<span v-else-if="preset.disabled">{{ message( 'ontologypresets-unavailable' ) }}</span>
						<cdx-button v-else action="progressive" weight="primary" @click="showApplyDialog = true">{{ message( 'ontologypresets-apply' ) }}</cdx-button>
					</div>
				</div>
				<p>{{ message( 'ontologypresets-preset-description', preset.propertyCount ) }}</p>
				<p class="ext-wikibase-ontology-presets-catalog__summary">{{ message( 'ontologypresets-property-count', preset.propertyCount ) }}</p>
				<dl class="ext-wikibase-ontology-presets-catalog__metadata">
					<div v-if="preset.version">
						<dt>{{ message( 'ontologypresets-metadata-version' ) }}</dt>
						<dd>{{ preset.version }}</dd>
					</div>
					<div v-if="preset.license">
						<dt>{{ message( 'ontologypresets-metadata-license' ) }}</dt>
						<dd><a :href="preset.license" rel="noopener noreferrer">{{ preset.rights || preset.license }}</a></dd>
					</div>
					<div v-if="preset.publisher">
						<dt>{{ message( 'ontologypresets-metadata-publisher' ) }}</dt>
						<dd><a :href="preset.publisher" rel="noopener noreferrer">{{ preset.publisher }}</a></dd>
					</div>
					<div v-if="preset.contributors && preset.contributors.length">
						<dt>{{ message( 'ontologypresets-metadata-contributors' ) }}</dt>
						<dd>{{ preset.contributors.join( ', ' ) }}</dd>
					</div>
				</dl>
				<div v-if="preset.properties && preset.properties.length" class="ext-wikibase-ontology-presets-catalog__table-scroll">
					<table class="ext-wikibase-ontology-presets-catalog__table">
						<thead>
							<tr>
								<th scope="col">{{ message( 'ontologypresets-property-table-id' ) }}</th>
								<th scope="col">{{ message( 'ontologypresets-property-table-label' ) }}</th>
								<th scope="col">{{ message( 'ontologypresets-property-table-datatype' ) }}</th>
								<th scope="col">{{ message( 'ontologypresets-property-table-description' ) }}</th>
								<th scope="col">{{ message( 'ontologypresets-property-table-wikidata-id' ) }}</th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="property in preset.properties" :key="property.id">
								<td>{{ property.id }}</td>
								<td>{{ property.label }}</td>
								<td>{{ property.datatype }}</td>
								<td>{{ property.description }}</td>
								<td>{{ property.wikidataId }}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</section>
		<cdx-dialog
			:open="showApplyDialog"
			:title="message( 'ontologypresets-apply-dialog-title', preset.propertyCount )"
			:primary-action="{ label: message( 'ontologypresets-apply' ), actionType: 'progressive' }"
			:default-action="{ label: message( 'ontologypresets-cancel' ) }"
			use-close-button
			@update:open="updateDialog"
			@primary="applyPreset"
			@default="closeDialog"
		>
			<form ref="applyForm" method="post" :action="config.pageUrl">
				<input type="hidden" name="token" :value="config.token">
				<input type="hidden" name="action" value="apply">
				<p>{{ message( 'ontologypresets-apply-confirmation', preset.title, preset.lastPropertyId ) }}</p>
			</form>
		</cdx-dialog>
	</section>
</template>

<script>
const { CdxButton, CdxDialog, CdxMessage } = require( '../../codex.js' );

module.exports = {
	name: 'OntologyPresetsApp',
	components: { CdxButton, CdxDialog, CdxMessage },
	data() {
		return {
			config: mw.config.get( 'wgWikibaseOntologyPresets' ) || { preset: {} },
			showApplyDialog: false
		};
	},
	computed: {
		preset() {
			return this.config.preset || {};
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
		applyPreset() {
			this.$refs.applyForm.submit();
		}
	}
};
</script>
