import type { SourceChange } from '../../lib/source-changes.js';

export type { SourceChange } from '../../lib/source-changes.js';

export interface SourcePin {
	variable: string;
	description: string;
	resolve: () => Promise<string>;
	compareUrl?: (previous: string, next: string) => string;
	commitUrl?: (commit: string) => string;
	archiveShaVariable?: string;
	archiveUrl?: (commit: string) => string;
}

export interface SourceUpdatePlan {
	contents: string;
	changes: SourceChange[];
	additionalContents?: Record<string, string>;
	refreshSources?: boolean;
}

export interface SelectOption<T extends string> {
	value: T;
	label: string;
	hint?: string;
}

export interface SourceUpdateInteraction {
	confirm: (message: string) => Promise<boolean>;
	select: <T extends string>(
		message: string,
		options: SelectOption<T>[]
	) => Promise<T>;
	note: (title: string, lines: string[]) => void;
	info: (message: string) => void;
}

export interface SourceUpdateProvider {
	image: string;
	additionalSourcePaths?: string[];
	describeChanges: (
		previousContents: string,
		nextContents: string
	) => SourceChange[];
	plan: (
		contents: string,
		interaction: SourceUpdateInteraction
	) => Promise<SourceUpdatePlan>;
	planWithAdditional?: (
		contents: string,
		additionalContents: Record<string, string>,
		interaction: SourceUpdateInteraction
	) => Promise<SourceUpdatePlan>;
	describeChangesWithAdditional?: (
		previousContents: string,
		nextContents: string,
		previousAdditionalContents: Record<string, string>,
		nextAdditionalContents: Record<string, string>
	) => SourceChange[];
}
