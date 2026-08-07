import { CommitParser } from 'conventional-commits-parser';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import semver from 'semver';
import type { RepositoryContext } from './context.js';
import { GitRepository } from './git.js';
import type { ReleaseProject } from './projects.js';
import type { FileUpdate } from './file-updates.js';

type Bump = 'major' | 'minor' | 'patch';

interface CommitRecord {
	subject: string;
	bump?: Bump;
}

const STABLE_VERSION = /^\d+\.\d+\.\d+$/u;

export function assertStableVersion( version: string, context: string ): void {
	if ( !STABLE_VERSION.test( version ) || !semver.valid( version ) ) {
		throw new Error(
			`${ context } must use a stable MAJOR.MINOR.PATCH version; received "${ version }".`
		);
	}
}

export interface VersionPlan {
	project: ReleaseProject;
	targetVersion: string;
	updates: FileUpdate[];
	reason: string;
}

export interface VersionPolicy {
	isRelevantWorkingChange: ( change: {
		context: RepositoryContext;
		git: GitRepository;
		project: ReleaseProject;
		path: string;
	} ) => boolean;
	additionalUpdates: ( update: {
		context: RepositoryContext;
		project: ReleaseProject;
		targetVersion: string;
	} ) => FileUpdate[];
}

interface ChangelogHeading {
	start: number;
	end: number;
	version: string;
	prefix: string;
	suffix: string;
}

const parser = new CommitParser();
function bumpRank( bump: Bump ): number {
	return { patch: 1, minor: 2, major: 3 }[ bump ];
}

function classifyCommit( message: string ): Bump | undefined {
	const parsed = parser.parse( message );
	if (
		parsed.notes.some( ( note ) => note.title.toLowerCase().includes( 'breaking' ) )
	) {
		return 'major';
	}
	if ( parsed.header && /^[^:(!]+(?:\([^)]*\))?!:/u.test( parsed.header ) ) {
		return 'major';
	}
	if ( parsed.type === 'feat' ) {
		return 'minor';
	}
	if ( parsed.type === 'fix' || parsed.type === 'perf' ) {
		return 'patch';
	}
	return undefined;
}

function readCommits(
	git: GitRepository,
	project: ReleaseProject,
	previousTag?: string
): CommitRecord[] {
	const range = previousTag ? `${ previousTag }..HEAD` : 'HEAD';
	const output = git.run( [
		'log',
		'--format=%H%x1f%B%x1e',
		range,
		'--',
		...project.pathspecs
	] );
	return output
		.split( '\x1e' )
		.map( ( record ) => record.trim() )
		.filter( Boolean )
		.map( ( record ) => {
			const [ , ...messageParts ] = record.split( '\x1f' );
			const message = messageParts.join( '\x1f' ).trim();
			return {
				subject: message.split( '\n' )[ 0 ],
				bump: classifyCommit( message )
			};
		} );
}

function findPreviousRelease(
	git: GitRepository,
	project: ReleaseProject
): {
		tag?: string;
		version?: string;
	} {
	const tagNames = [ project.name, ...project.legacyTagNames ];
	const candidates = [ ...git.remoteTags().keys() ]
		.filter( ( tag ) => tagNames.some( ( name ) => tag.startsWith( `${ name }@` ) ) )
		.map( ( tag ) => ( {
			tag,
			version: tag.slice( tag.lastIndexOf( '@' ) + 1 )
		} ) )
		.filter( ( candidate ) => semver.valid( candidate.version ) )
		.sort( ( left, right ) => semver.rcompare( left.version, right.version ) );
	return candidates[ 0 ] ?? {};
}

function hasRelevantWorkingChanges(
	git: GitRepository,
	context: RepositoryContext,
	project: ReleaseProject,
	policy: VersionPolicy
): boolean {
	const changed = git
		.run( [ 'diff', '--name-only', 'HEAD', '--', ...project.pathspecs ] )
		.split( '\n' )
		.filter( Boolean );
	const generated = new Set(
		[ project.packagePath, project.changelogPath ].map( ( path ) =>
			relative( context.repositoryRoot, path )
		)
	);
	return changed.some( ( path ) => {
		if ( generated.has( path ) ) {
			return false;
		}
		return policy.isRelevantWorkingChange( { context, git, project, path } );
	} );
}

function parseHeadings( changelog: string ): ChangelogHeading[] {
	const pattern =
		/^(#{1,6}[ \t]+)(?:\*\*)?(?:[^\s@]+@)?(Unreleased|\d+\.\d+\.\d+)(?:\*\*)?([ \t]*(?:\([^\n)]*\))?[^\n]*)$/gimu;
	const headings: ChangelogHeading[] = [];
	let match: RegExpExecArray | null;
	while ( ( match = pattern.exec( changelog ) ) !== null ) {
		headings.push( {
			start: match.index,
			end: match.index + match[ 0 ].length,
			prefix: match[ 1 ],
			version: match[ 2 ],
			suffix: match[ 3 ]
		} );
	}
	return headings;
}

export function hasChangelogVersion(
	changelog: string,
	version: string
): boolean {
	return parseHeadings( changelog ).some(
		( heading ) => heading.version === version
	);
}

function findDraftHeadings(
	headings: ChangelogHeading[],
	publishedVersions: Set<string>
): ChangelogHeading[] {
	const firstPublishedIndex = headings.findIndex(
		( heading ) =>
			heading.version !== 'Unreleased' && publishedVersions.has( heading.version )
	);
	return headings
		.slice(
			0,
			firstPublishedIndex === -1 ? headings.length : firstPublishedIndex
		)
		.filter(
			( heading ) =>
				heading.version === 'Unreleased' ||
				!publishedVersions.has( heading.version )
		);
}

function updateChangelog(
	project: ReleaseProject,
	changelog: string,
	targetVersion: string,
	publishedVersions: Set<string>,
	commits: CommitRecord[],
	date: string
): string {
	const headings = parseHeadings( changelog );
	const draftHeadings = findDraftHeadings( headings, publishedVersions );
	if ( draftHeadings.length > 1 ) {
		throw new Error(
			`${ project.name } changelog contains multiple untagged release entries.`
		);
	}
	const generatedBody = commits
		.filter( ( commit ) => commit.bump )
		.map( ( commit ) => `- ${ commit.subject }` )
		.join( '\n' );
	if ( draftHeadings.length === 0 ) {
		const newEntryHeading = `# ${ targetVersion } (${ date })`;
		const generatedDraftBody =
			generatedBody || '- Release changes to be documented.';
		const firstContent = changelog.search( /\S/u );
		const normalizedChangelog =
			firstContent === -1 ? '' : changelog.slice( firstContent );
		return `${ newEntryHeading }\n\n${ generatedDraftBody }\n\n${ normalizedChangelog }`;
	}
	const draft = draftHeadings[ 0 ];
	const nextHeading = headings.find( ( heading ) => heading.start > draft.start );
	const bodyEnd = nextHeading ? nextHeading.start : changelog.length;
	const body = changelog.slice( draft.end, bodyEnd );
	const hasBody = body.trim().length > 0;
	const draftHeading =
		draft.version === targetVersion && hasBody ?
			changelog.slice( draft.start, draft.end ) :
			`# ${ targetVersion } (${ date })`;
	const replacementBody = hasBody ?
		body :
		`\n\n${ generatedBody || '- Release changes to be documented.' }\n\n`;
	return (
		changelog.slice( 0, draft.start ) +
		draftHeading +
		replacementBody +
		changelog.slice( bodyEnd )
	);
}

function packageWithVersion( contents: string, version: string ): string {
	const packageJson = JSON.parse( contents ) as Record<string, unknown>;
	packageJson.version = version;
	return `${ JSON.stringify( packageJson, null, '\t' ) }\n`;
}

export function planVersionUpdate(
	context: RepositoryContext,
	git: GitRepository,
	project: ReleaseProject,
	policy: VersionPolicy,
	date = new Date().toISOString().slice( 0, 10 )
): VersionPlan | undefined {
	const packageContents = readFileSync( project.packagePath, 'utf8' );
	const packageJson = JSON.parse( packageContents ) as { version: string };
	assertStableVersion( packageJson.version, `${ project.name } package` );
	const previous = findPreviousRelease( git, project );
	const commits = readCommits( git, project, previous.tag );
	const bumps = commits.map( ( commit ) => commit.bump ).filter( Boolean ) as Bump[];
	if ( hasRelevantWorkingChanges( git, context, project, policy ) ) {
		bumps.push( 'patch' );
	}
	const bump = bumps.sort( ( left, right ) => bumpRank( right ) - bumpRank( left ) )[ 0 ];
	let inferred = previous.version;
	if ( bump && previous.version ) {
		inferred = semver.inc( previous.version, bump ) ?? undefined;
	}
	const changelog = readFileSync( project.changelogPath, 'utf8' );
	const publishedVersions = new Set(
		[ ...git.remoteTags().keys() ]
			.filter( ( tag ) =>
				[ project.name, ...project.legacyTagNames ].some( ( name ) =>
					tag.startsWith( `${ name }@` )
				)
			)
			.map( ( tag ) => tag.slice( tag.lastIndexOf( '@' ) + 1 ) )
	);
	const hasDraft =
		findDraftHeadings( parseHeadings( changelog ), publishedVersions ).length > 0;
	if ( !bump && !hasDraft && previous.version === packageJson.version ) {
		return undefined;
	}
	const targetVersion = [ packageJson.version, inferred ]
		.filter( Boolean )
		.sort( ( left, right ) => semver.rcompare( left!, right! ) )[ 0 ]!;
	assertStableVersion( targetVersion, `${ project.name } release` );
	const updates: FileUpdate[] = [
		{
			path: project.packagePath,
			contents: packageWithVersion( packageContents, targetVersion )
		},
		{
			path: project.changelogPath,
			contents: updateChangelog(
				project,
				changelog,
				targetVersion,
				publishedVersions,
				commits,
				date
			)
		}
	];
	updates.push(
		...policy.additionalUpdates( { context, project, targetVersion } )
	);
	return {
		project,
		targetVersion,
		updates,
		reason: bump ? `${ bump } release` : 'existing untagged release draft'
	};
}
