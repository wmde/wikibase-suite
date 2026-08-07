import type { Option } from '@clack/prompts';
import { confirm, isCancel, log, note, select } from '@clack/prompts';
import type { SelectOption, SourceUpdateInteraction } from './source-types.js';

export class UpdateCancelled extends Error {}

function unwrapPrompt<T>(value: T | symbol): T {
	if (isCancel(value)) {
		throw new UpdateCancelled();
	}
	return value;
}

export class ClackInteraction implements SourceUpdateInteraction {
	async confirm(message: string): Promise<boolean> {
		return unwrapPrompt(await confirm({ message, initialValue: true }));
	}

	async select<T extends string>(
		message: string,
		options: SelectOption<T>[]
	): Promise<T> {
		return unwrapPrompt(
			await select<T>({ message, options: options as Option<T>[] })
		);
	}

	note(title: string, lines: string[]): void {
		note(lines.join('\n'), title);
	}

	info(message: string): void {
		log.info(message);
	}
}
