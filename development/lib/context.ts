import { join, resolve } from 'node:path';

export interface RepositoryContext {
	developmentRoot: string;
	repositoryRoot: string;
	hostRepositoryRoot: string;
	imagesRoot: string;
	testRoot: string;
}

export function createRepositoryContext(
	developmentRoot = process.cwd()
): RepositoryContext {
	const repositoryRoot = resolve( developmentRoot, '..' );
	return {
		developmentRoot,
		repositoryRoot,
		hostRepositoryRoot: resolve( process.env.HOST_PWD ?? repositoryRoot ),
		imagesRoot: join( repositoryRoot, 'docker-images' ),
		testRoot: join( developmentRoot, 'tests' )
	};
}
