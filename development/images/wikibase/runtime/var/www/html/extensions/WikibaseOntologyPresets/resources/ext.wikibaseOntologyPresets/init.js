const Vue = require( 'vue' );
const OntologyPresetsApp = require( './OntologyPresetsApp.vue' );

const target = document.getElementById( 'wikibase-ontology-presets-app' );
if ( target ) {
	Vue.createMwApp( OntologyPresetsApp ).mount( target );
}
