import type { ReleaseProject } from '../../../lib/projects.js';
import type { VersionPolicy } from '../../../lib/versioning.js';
import { defaultVersionPolicy } from './default.js';
import { wbsVersionPolicy } from './wbs.js';

const projectPolicies = new Map<string, VersionPolicy>( [
	[ 'wbs', wbsVersionPolicy ]
] );

export function versionPolicyFor( project: ReleaseProject ): VersionPolicy {
	return projectPolicies.get( project.name ) ?? defaultVersionPolicy;
}
