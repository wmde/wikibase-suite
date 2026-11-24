import { chmodSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export interface FileUpdate {
	path: string;
	contents: string;
}

export function applyFileUpdates( updates: FileUpdate[] ): number {
	const originals = new Map(
		updates.map( ( update ) => [ update.path, {
			contents: readFileSync( update.path, 'utf8' ),
			mode: statSync( update.path ).mode & 0o777
		} ] )
	);
	const changed = updates.filter(
		( update ) => originals.get( update.path )!.contents !== update.contents
	);
	const temporary: { update: FileUpdate; tempPath: string }[] = [];
	const appliedPaths: string[] = [];

	try {
		for ( const [ index, update ] of changed.entries() ) {
			const tempPath = join(
				dirname( update.path ),
				`.${ basename( update.path ) }.wbs-dev-${ process.pid }-${ index }`
			);
			temporary.push( { update, tempPath } );
			writeFileSync( tempPath, update.contents, { mode: originals.get( update.path )!.mode } );
			chmodSync( tempPath, originals.get( update.path )!.mode );
		}
		for ( const item of temporary ) {
			renameSync( item.tempPath, item.update.path );
			appliedPaths.push( item.update.path );
		}
	} catch ( error ) {
		for ( const path of appliedPaths ) {
			const original = originals.get( path )!;
			writeFileSync( path, original.contents );
			chmodSync( path, original.mode );
		}
		throw error;
	} finally {
		for ( const item of temporary ) {
			rmSync( item.tempPath, { force: true } );
		}
	}
	return changed.length;
}
