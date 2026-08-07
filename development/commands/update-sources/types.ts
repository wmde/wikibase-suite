export interface SourcePin {
	variable: string;
	description: string;
	resolve: () => Promise<string>;
	archiveShaVariable?: string;
	archiveUrl?: (commit: string) => string;
}

export interface SourceUpdateProvider {
	image: string;
	sources: (contents: string) => SourcePin[];
}
