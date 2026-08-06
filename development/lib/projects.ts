import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { RepositoryContext } from './context.js';
import { resolveNames } from './selection.js';

export interface ReleaseProject {
	name: string;
	packagePath: string;
	changelogPath: string;
	pathspecs: string[];
	legacyTagNames: string[];
	isImage: boolean;
}

export function discoverImageNames( context: RepositoryContext ): string[] {
	return readdirSync( context.imagesRoot )
		.filter( ( entry ) => {
			const projectRoot = join( context.imagesRoot, entry );
			return (
				statSync( projectRoot ).isDirectory() &&
				existsSync( join( projectRoot, 'Dockerfile' ) ) &&
				existsSync( join( projectRoot, 'package.json' ) )
			);
		} )
		.map( ( entry ) => {
			const packageJson = JSON.parse(
				readFileSync( join( context.imagesRoot, entry, 'package.json' ), 'utf8' )
			) as { name?: string };
			if ( !packageJson.name ) {
				throw new Error( `Image project ${ entry } has no package name.` );
			}
			if ( packageJson.name !== entry ) {
				throw new Error(
					`Image directory ${ entry } does not match package name ${ packageJson.name }.`
				);
			}
			return entry;
		} )
		.sort();
}

export function discoverReleaseProjects(
	context: RepositoryContext
): ReleaseProject[] {
	return [
		{
			name: 'wbs',
			packagePath: join( context.repositoryRoot, 'package.json' ),
			changelogPath: join( context.repositoryRoot, 'CHANGELOG.md' ),
			pathspecs: [
				'.env.example',
				'README.md',
				'package.json',
				'CHANGELOG.md',
				'docker-compose.yml',
				'docker-compose.local.yml',
				'install',
				'wbs',
				'config',
				'docs',
				'scripts',
				'development/docker-compose.local-images.yml'
			],
			legacyTagNames: [ 'deploy' ],
			isImage: false
		},
		...discoverImageNames( context ).map(
			( name ): ReleaseProject => ( {
				name,
				packagePath: join( context.imagesRoot, name, 'package.json' ),
				changelogPath: join( context.imagesRoot, name, 'CHANGELOG.md' ),
				pathspecs: [ `docker-images/${ name }` ],
				legacyTagNames: [],
				isImage: true
			} )
		)
	];
}

export function resolveProjectSelections(
	requested: string[],
	projects: ReleaseProject[],
	command: string,
	options: { requireExplicit?: boolean; imagesOnly?: boolean } = {}
): ReleaseProject[] {
	const availableProjects = projects.filter(
		( project ) => !options.imagesOnly || project.isImage
	);
	const names = resolveNames(
		requested,
		availableProjects.map( ( project ) => project.name ),
		{ command, noun: 'project', requireExplicit: options.requireExplicit }
	);
	return names.map(
		( name ) => availableProjects.find( ( project ) => project.name === name )!
	);
}
