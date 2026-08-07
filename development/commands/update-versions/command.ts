import type { Command } from 'commander';
import type { RepositoryContext } from '../../lib/context.js';
import { applyFileUpdates, type FileUpdate } from '../../lib/file-updates.js';
import { GitRepository } from '../../lib/git.js';
import {
	discoverReleaseProjects,
	resolveProjectSelections
} from '../../lib/projects.js';
import { planVersionUpdate, type VersionPlan } from '../../lib/versioning.js';
import { versionPolicyFor } from './policies/index.js';

function isVersionPlan( plan: VersionPlan | undefined ): plan is VersionPlan {
	return plan !== undefined;
}

async function updateVersions(
	requested: string[],
	context: RepositoryContext
): Promise<void> {
	const projects = resolveProjectSelections(
		requested,
		discoverReleaseProjects( context ),
		'update-versions',
		{ requireExplicit: true }
	);
	const git = new GitRepository( context );
	git.fetchRemoteTags();
	const plans = projects
		.map( ( project ) =>
			planVersionUpdate( context, git, project, versionPolicyFor( project ) )
		)
		.filter( isVersionPlan );
	if ( plans.length === 0 ) {
		console.log( 'No selected projects have releasable changes.' );
		return;
	}
	for ( const plan of plans ) {
		console.log(
			`Preparing ${ plan.project.name } ${ plan.targetVersion } (${ plan.reason }).`
		);
	}
	const updates = plans.reduce<FileUpdate[]>(
		( accumulated, plan ) => [ ...accumulated, ...plan.updates ],
		[]
	);
	applyFileUpdates( updates );
	console.log(
		'Updated local files. Nothing was staged, committed, tagged, or pushed. Review with git diff.'
	);
}

export function registerUpdateVersionsCommand(
	program: Command,
	context: RepositoryContext
): void {
	const projectNames = discoverReleaseProjects( context ).map(
		( project ) => project.name
	);
	program
		.command( 'update-versions' )
		.description(
			'Infer versions and update local package files and changelogs atomically.'
		)
		.argument( '<projects...>', 'PROJECT...|all' )
		.addHelpText(
			'after',
			`\nProjects:\n  ${ projectNames.join( ', ' ) }\n  Select one or more projects, or "all" by itself.`
		)
		.action(
			async ( projects: string[] ) => await updateVersions( projects, context )
		);
}
