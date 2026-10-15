import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const validationScript = fileURLToPath(
	new URL( './validate-bundles.sh', import.meta.url )
);

describe( 'Bundled ontology profiles', function () {
	it( 'conform to the SHACL validation profiles', function () {
		execFileSync( validationScript, { stdio: 'inherit' } );
	} );
} );
