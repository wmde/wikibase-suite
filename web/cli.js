import { promises as dns } from 'dns';
import { readFileSync } from 'fs';
import { cancel, confirm, intro, isCancel, log, note, outro, password, spinner, text } from '@clack/prompts';
import { stdin as input, stdout as output } from 'process';
import { getConfig, isConfigSaved, isLocalhostSetup, saveConfigText } from './serverHelpers.js';
import { validateSetupPassword } from './passwordPolicy.js';
import { HOST_NAME_REGEX, isValidAdminUsername, isValidDatabaseName, isValidDatabaseUser, isValidEmailAddress } from './shared/validation.js';
const serverIp = process.env.SERVER_IP || '';
const pipedAnswers = input.isTTY ? [] : readFileSync(0, 'utf8').split(/\r?\n/);
function abortSetup() {
    cancel('Setup canceled.');
    process.exit(130);
}
function unwrapPromptValue(value) {
    if (isCancel(value)) {
        abortSetup();
    }
    return value;
}
function unwrapPromptString(value) {
    if (isCancel(value)) {
        abortSetup();
    }
    return value ?? '';
}
function readPipedAnswer(label) {
    const answer = (pipedAnswers.shift() ?? '').trim();
    output.write(`${label}: ${answer}\n`);
    return answer;
}
function readPipedSecret(label, placeholder) {
    output.write(`${label} (${placeholder}):\n`);
    return (pipedAnswers.shift() ?? '').trim();
}
function showIntro() {
    if (input.isTTY) {
        intro('Configure Wikibase Suite Deploy');
        if (!isLocalhostSetup()) {
            note(serverIp, 'Public IP of this server');
        }
        return;
    }
    console.log('\nConfigure Wikibase Suite Deploy\n');
    if (!isLocalhostSetup()) {
        console.log(`Public IP of this server: ${serverIp}\n`);
    }
}
async function promptText(label, defaultValue = '', validate) {
    if (!input.isTTY) {
        return readPipedAnswer(defaultValue ? `${label} [${defaultValue}]` : label) || defaultValue;
    }
    return unwrapPromptString(await text({
        message: label,
        defaultValue: defaultValue || undefined,
        initialValue: defaultValue || undefined,
        validate: (value) => validate?.(String(value ?? '').trim())
    }));
}
async function promptUntil(label, defaultValue, validator, message, options = { required: true }) {
    while (true) {
        const value = (await promptText(label, defaultValue, (candidate) => {
            if (!candidate && options.required !== false) {
                return 'This field is required.';
            }
            return undefined;
        })).trim();
        if (!value && options.required === false) {
            return value;
        }
        const progress = input.isTTY && options.spinnerMessage ? spinner() : null;
        progress?.start(options.spinnerMessage);
        const valid = await validator(value);
        progress?.stop(valid ? 'Validated.' : undefined);
        if (valid) {
            return value;
        }
        if (input.isTTY) {
            log.error(message);
        }
        else {
            console.log(message);
        }
    }
}
async function promptYesNo(label, defaultValue) {
    if (!input.isTTY) {
        const suffix = defaultValue ? '[Y/n]' : '[y/N]';
        const answer = readPipedAnswer(`${label} ${suffix}`).toLowerCase();
        if (!answer) {
            return defaultValue;
        }
        return answer.startsWith('y');
    }
    return unwrapPromptValue(await confirm({
        message: label,
        initialValue: defaultValue
    }));
}
function validatePasswordMessage(value) {
    const validation = validateSetupPassword(value ?? '');
    if (validation.valid) {
        return undefined;
    }
    if (validation.reason === 'common-password') {
        return 'That password is too common. Leave it blank to use the generated password, or choose another password.';
    }
    return 'Password must be at least 10 characters, or blank to use the generated password.';
}
async function promptPasswordUntil(label) {
    const hasSavedConfig = isConfigSaved();
    const promptHelp = hasSavedConfig ?
        'press Enter to keep existing password' :
        'leave blank to use generated password';
    const promptLabel = `${label} (${promptHelp})`;
    if (!input.isTTY) {
        while (true) {
            const value = readPipedSecret(label, promptHelp);
            const validationMessage = validatePasswordMessage(value);
            if (validationMessage === undefined) {
                return value;
            }
            console.log(validationMessage);
        }
    }
    while (true) {
        const value = unwrapPromptString(await password({
            message: promptLabel,
            validate: validatePasswordMessage
        }));
        if (value.length === 0) {
            return value;
        }
        const confirmation = unwrapPromptString(await password({
            message: `Confirm ${label.toLowerCase()}`
        }));
        if (value === confirmation) {
            return value;
        }
        log.error('Passwords do not match. Try again, or leave the password blank to generate one.');
    }
}
async function hostResolvesToServer(hostname) {
    const host = hostname.trim();
    if (!HOST_NAME_REGEX.test(host)) {
        return false;
    }
    if (isLocalhostSetup() && /\.test$/i.test(host)) {
        return true;
    }
    if (!serverIp) {
        return false;
    }
    try {
        const addresses = await dns.resolve4(host);
        return addresses.includes(serverIp);
    }
    catch {
        return false;
    }
}
async function gatherConfig() {
    const { config: defaults } = getConfig();
    const wikibaseHostDefault = defaults.WIKIBASE_PUBLIC_HOST || '';
    const MW_ADMIN_EMAIL = await promptUntil('Admin email address', defaults.MW_ADMIN_EMAIL || '', isValidEmailAddress, 'Enter a valid email address.');
    const WIKIBASE_PUBLIC_HOST = await promptUntil('Wikibase host', wikibaseHostDefault, hostResolvesToServer, `Host must resolve to this server IP address (${serverIp}).`, { spinnerMessage: 'Checking DNS for Wikibase host...' });
    const WDQS_PUBLIC_HOST = await promptUntil('Query Service host', defaults.WDQS_PUBLIC_HOST || `query.${WIKIBASE_PUBLIC_HOST}`, hostResolvesToServer, `Host must resolve to this server IP address (${serverIp}).`, { spinnerMessage: 'Checking DNS for Query Service host...' });
    const METADATA_CALLBACK = await promptYesNo('Make this Wikibase visible in the global Wikibase directory?', String(defaults.METADATA_CALLBACK).toLowerCase() !== 'false');
    const MW_ADMIN_NAME = await promptUntil('Admin username', defaults.MW_ADMIN_NAME || 'Admin', isValidAdminUsername, 'Admin username must be at least 4 characters and use MediaWiki-compatible characters.');
    const MW_ADMIN_PASS = await promptPasswordUntil('Admin password');
    const DB_NAME = await promptUntil('Database name', defaults.DB_NAME || 'my_wiki', isValidDatabaseName, 'Database name must be 1-64 characters and use letters, numbers, or underscores.');
    const DB_USER = await promptUntil('Database user', defaults.DB_USER || 'sqluser', isValidDatabaseUser, 'Database user must be at least 4 characters and use letters, numbers, or underscores.');
    const DB_PASS = await promptPasswordUntil('Database password');
    return {
        MW_ADMIN_EMAIL,
        WIKIBASE_PUBLIC_HOST,
        WDQS_PUBLIC_HOST,
        METADATA_CALLBACK: METADATA_CALLBACK ? 'true' : 'false',
        MW_ADMIN_NAME,
        MW_ADMIN_PASS: MW_ADMIN_PASS || defaults.MW_ADMIN_PASS || '',
        DB_NAME,
        DB_USER,
        DB_PASS: DB_PASS || defaults.DB_PASS || ''
    };
}
async function main() {
    showIntro();
    const inputConfig = await gatherConfig();
    const { configText } = getConfig(inputConfig);
    saveConfigText(configText);
    if (input.isTTY) {
        outro('Configuration saved.');
    }
    else {
        console.log('\nConfiguration saved.\n');
    }
}
void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
