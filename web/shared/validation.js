export const EMAIL_ADDRESS_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COMMON_PASSWORD_OVERRIDES = new Set([
    'change-this-password'
]);
const MEDIAWIKI_INVALID_USERNAME_CHARACTERS = /[@:>=]/;
const IPV4_ADDRESS_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const SAFE_DATABASE_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const SAFE_DATABASE_USER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,79}$/;
function normalizePassword(value) {
    return value.trim().toLowerCase();
}
export function isValidEmailAddress(value) {
    return EMAIL_ADDRESS_REGEX.test(value.trim());
}
export function isValidAdminUsername(value) {
    const username = value.trim();
    return username.length > 1 &&
        username.length <= 255 &&
        !MEDIAWIKI_INVALID_USERNAME_CHARACTERS.test(username) &&
        !IPV4_ADDRESS_PATTERN.test(username);
}
export function isValidDatabaseName(value) {
    return SAFE_DATABASE_IDENTIFIER_PATTERN.test(value.trim());
}
export function isValidDatabaseUser(value) {
    const username = value.trim();
    return username.length > 1 &&
        SAFE_DATABASE_USER_PATTERN.test(username);
}
export function validatePassword(value, commonPasswords = COMMON_PASSWORD_OVERRIDES) {
    const password = value.trim();
    if (password.length === 0) {
        return { valid: true };
    }
    if (password.length < 10) {
        return { valid: false, reason: 'too-short' };
    }
    if (password.length > 4096) {
        return { valid: false, reason: 'too-long' };
    }
    if (commonPasswords.has(normalizePassword(password)) ||
        COMMON_PASSWORD_OVERRIDES.has(normalizePassword(password))) {
        return { valid: false, reason: 'common-password' };
    }
    return { valid: true };
}
export function isValidPassword(value, commonPasswords) {
    return validatePassword(value, commonPasswords).valid;
}
