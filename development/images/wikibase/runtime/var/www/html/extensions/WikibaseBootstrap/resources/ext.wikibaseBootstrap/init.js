const Vue = require( 'vue' );
const OntologyBootstrapApp = require( './OntologyBootstrapApp.vue' );

const target = document.getElementById( 'wikibase-bootstrap-app' );
if ( target ) {
	Vue.createMwApp( OntologyBootstrapApp ).mount( target );
}
