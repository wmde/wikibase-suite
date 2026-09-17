import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { RepositoryContext } from '../../lib/context.js';

export function suiteConfigPath(
	context: RepositoryContext,
	suiteName: string
): string {
	return join( context.testRoot, suiteName, `${ suiteName }.conf.ts` );
}

export function discoverSuiteNames( context: RepositoryContext ): string[] {
	if ( !existsSync( context.testRoot ) ) {
		return [];
	}
	return readdirSync( context.testRoot, { withFileTypes: true } )
		.filter(
			( entry ) =>
				entry.isDirectory() &&
				!entry.name.startsWith( '_' ) &&
				entry.name !== 'node_modules' &&
				existsSync( suiteConfigPath( context, entry.name ) )
		)
		.map( ( entry ) => entry.name )
		.sort();
}

export function discoverTestTargetNames(
	context: RepositoryContext
): string[] {
	return [ 'wbs-dev-tools', ...discoverSuiteNames( context ) ];
}
