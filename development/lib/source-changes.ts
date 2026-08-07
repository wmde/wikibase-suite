export interface SourceChange {
	variable: string;
	description: string;
	previous?: string;
	next: string;
	link?: {
		label: string;
		url: string;
	};
}
