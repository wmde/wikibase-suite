import js from '@eslint/js';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import {
	defineConfigWithVueTs,
	vueTsConfigs
} from '@vue/eslint-config-typescript';
import jsonc from 'eslint-plugin-jsonc';
import mocha from 'eslint-plugin-mocha';
import vue from 'eslint-plugin-vue';
import wdio from 'eslint-plugin-wdio';
import yml from 'eslint-plugin-yml';
import { globalIgnores } from 'eslint/config';
import globals from 'globals';

const nodeFiles = [
	'development/wbs-dev.ts',
	'development/wbs-dev.spec.ts',
	'development/commands/**/*.ts',
	'development/lib/**/*.ts',
	'development/tests/**/*.{cjs,js,mjs,ts}',
	'docker-images/wbs-tools/{wbs.ts,commands/**/*.ts,cli/**/*.ts,lib/**/*.ts,web/*.ts}'
];

const testFiles = [
	'development/wbs-dev.spec.ts',
	'development/commands/**/*.spec.ts',
	'development/lib/**/*.spec.ts',
	'development/tests/**/*.spec.ts'
];

export default defineConfigWithVueTs(
	globalIgnores( [
		'**/node_modules/**',
		'**/dist/**',
		'**/results/**',
		'**/tmp/**',
		'docker-images/wbs-tools/web/public/assets/**',
		'development/pnpm-lock.yaml',
		'config/extensions/**',
		'.git/**'
	] ),
	js.configs.recommended,
	vue.configs[ 'flat/essential' ],
	vueTsConfigs.recommended,
	jsonc.configs[ 'flat/recommended-with-json' ],
	yml.configs[ 'flat/recommended' ],
	{
		name: 'wbs/source',
		files: [ '**/*.{cjs,js,mjs,ts,vue}' ],
		rules: {
			'eol-last': [ 'error', 'always' ]
		}
	},
	{
		name: 'wbs/typescript',
		files: [ '**/*.{ts,vue}' ],
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
					varsIgnorePattern: '^_'
				}
			]
		}
	},
	{
		name: 'wbs/node',
		files: nodeFiles,
		languageOptions: {
			globals: globals.node
		}
	},
	{
		name: 'wbs/browser',
		files: [ 'docker-images/wbs-tools/web/client/**/*.{ts,vue}' ],
		languageOptions: {
			globals: globals.browser
		}
	},
	{
		...mocha.configs.recommended,
		name: 'wbs/mocha',
		files: testFiles,
		rules: {
			...mocha.configs.recommended.rules,
			'mocha/no-mocha-arrows': 'off',
			'mocha/no-pending-tests': 'warn',
			'mocha/no-setup-in-suite': 'warn'
		}
	},
	{
		...wdio.configs[ 'flat/recommended' ],
		name: 'wbs/webdriverio',
		files: [ 'development/tests/**/*.ts' ],
		rules: {
			...wdio.configs[ 'flat/recommended' ].rules,
			'wdio/no-pause': 'warn'
		}
	},
	{
		name: 'wbs/yaml-empty-mapping',
		files: [ '**/docker-compose*.{yaml,yml}', '.github/workflows/*.{yaml,yml}' ],
		rules: {
			'yml/no-empty-mapping-value': 'off'
		}
	},
	skipFormatting
);
