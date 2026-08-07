import { join } from 'node:path';
import { buildAllImages } from '../build/images.js';
import type { RepositoryContext } from '../../lib/context.js';
import {
	type CommandRunner,
	ProcessCommandRunner
} from '../../lib/process.js';

export interface InstallerDevWebDependencies {
	buildLocalImages: () => Promise<void>;
	commandRunner: CommandRunner;
}

export interface InstallerDevWebOptions {
	mock?: boolean;
}

function defaultDependencies(
	context: RepositoryContext
): InstallerDevWebDependencies {
	return {
		buildLocalImages: async () => await buildAllImages( context ),
		commandRunner: new ProcessCommandRunner()
	};
}

export async function runInstallerDevWeb(
	context: RepositoryContext,
	options: InstallerDevWebOptions = {},
	dependencies = defaultDependencies( context )
): Promise<void> {
	const root = context.hostRepositoryRoot;
	if ( !options.mock ) {
		await dependencies.buildLocalImages();
	}

	const imageRegistry = process.env.WBS_TEST_IMAGE_REGISTRY ?? 'wikibase';
	const imageTag = process.env.WBS_TEST_IMAGE_TAG ?? 'latest';
	const stateRoot = join( root, '.wbs' );
	await dependencies.commandRunner.run(
		'bash',
		[ join( root, 'scripts', 'run-web-installer.sh' ) ],
		{
			cwd: root,
			output: 'inherit',
			env: {
				...process.env,
				DEBUG: 'false',
				ENV_FILE_PATH: join( root, '.env' ),
				INSTALLER_DEV: 'true',
				INSTALLER_DEV_MOCK: options.mock ? 'true' : 'false',
				CONFIGURE_ONLY: 'false',
				LAUNCH_TRIGGER_PATH: join( stateRoot, 'installer-dev-launch-ready' ),
				LOCALHOST: 'true',
				WBS_LOG_PATH: join( stateRoot, 'installer-dev.log' ),
				INSTALLATION_LOG_PATH: join( stateRoot, 'installer-dev-installation.log' ),
				SKIP_DEPENDENCY_INSTALLS: 'true',
				SCRIPTS_DIR: join( root, 'scripts' ),
				WBS_DIR: root,
				WBS_DEVELOPMENT_ROOT: context.developmentRoot,
				WBS_INSTALLER_CONTAINER_NAME: 'wbs-dev-installer-web',
				WBS_INSTALLER_WORKER_CONTAINER_NAME: 'wbs-dev-installer-worker',
				WBS_LAUNCH_FOREGROUND: 'true',
				WBS_LOCAL_IMAGES: 'true',
				WBS_STATE_DIR: stateRoot,
				WBS_TOOLS_ENV_PASSTHROUGH: 'WBS_TEST_IMAGE_REGISTRY WBS_TEST_IMAGE_TAG',
				WBS_TOOLS_IMAGE: `${ imageRegistry }/wbs-tools:${ imageTag }`
			}
		}
	);
}
