// Keep the Python controller and PHP maintenance script beside compiled command.ts.
import { copyFileSync, mkdirSync } from 'node:fs';
const target = new URL( '../../dist/commands/import/', import.meta.url );
mkdirSync( target, { recursive: true } );
for ( const name of [ 'bulk_import.py', 'ImportEntities.php' ] ) {
	copyFileSync( new URL( name, import.meta.url ), new URL( name, target ) );
}
