import i18next from 'i18next';

export type TextDirection = 'ltr' | 'rtl';

export type LocaleOption = {
	code: string;
};

const FALLBACK_LOCALE = 'en-US';

const findSupportedLocale = (candidate: string | null | undefined, supportedLocales: string[]) => {
	if (!candidate) return undefined;

	const normalized = candidate.replace('_', '-').toLowerCase();
	const exact = supportedLocales.find((locale) => locale.toLowerCase() === normalized);
	if (exact) return exact;

	const language = normalized.split('-')[0];
	return supportedLocales.find((locale) => locale.toLowerCase().split('-')[0] === language);
};

export const LOCALE_STORAGE_KEY = 'locale';
export const LOCALE_CHOICE_KEY = 'localeChoice';
export const LOCALE_MIGRATED_KEY = 'localeDefaultMigrated';
export const DEPLOYMENT_LOCALE_KEY = 'deploymentLocale';

type SupportedLocales = Array<string | LocaleOption>;

const toCodes = (locales: SupportedLocales) =>
	locales.map((locale) => (typeof locale === 'string' ? locale : locale.code));

/**
 * Resolve the UI language without mutating storage. Priority: URL override,
 * a saved choice, the deployment default, the browser language, then English.
 * The saved value is only trusted when it was an explicit choice (see
 * `migrateLocalePreference`), so an auto-detected value cannot outrank the
 * deployment default.
 */
export const resolveLocale = ({
	queryLocale,
	savedLocale,
	browserLocales = [],
	supportedLocales,
	deploymentLocale,
	fallbackLocale = FALLBACK_LOCALE
}: {
	queryLocale?: string | null;
	savedLocale?: string | null;
	browserLocales?: string[];
	supportedLocales: SupportedLocales;
	deploymentLocale?: string | null;
	fallbackLocale?: string;
}) => {
	const supported = toCodes(supportedLocales);

	for (const candidate of [queryLocale, savedLocale, deploymentLocale, ...browserLocales]) {
		const match = findSupportedLocale(candidate, supported);
		if (match) return match;
	}

	return findSupportedLocale(fallbackLocale, supported) ?? fallbackLocale;
};

export type LocalePreference = {
	/** The saved locale to keep, or null when it should be discarded. */
	savedLocale: string | null;
	/** True when the saved locale is a deliberate user choice. */
	explicit: boolean;
	/** True when the one-time migration has already run for this browser. */
	migrated: boolean;
};

/**
 * One-time migration for browsers that visited before the deployment default
 * existed. i18next used to cache whatever it auto-detected in `locale`, so a
 * saved value alone is not proof of a choice. A saved value that equals the
 * browser's own language is treated as that cache and dropped; a value that
 * differs from it can only have been picked by the user and becomes explicit.
 * Runs once; afterwards only `explicit` choices are written.
 */
export const migrateLocalePreference = ({
	savedLocale,
	explicit,
	migrated,
	browserLocales = [],
	supportedLocales
}: {
	savedLocale?: string | null;
	explicit?: boolean;
	migrated?: boolean;
	browserLocales?: string[];
	supportedLocales: SupportedLocales;
}): LocalePreference => {
	if (!savedLocale) return { savedLocale: null, explicit: false, migrated: true };
	if (explicit || migrated) return { savedLocale, explicit: !!explicit, migrated: true };

	const supported = toCodes(supportedLocales);
	const saved = findSupportedLocale(savedLocale, supported);
	const detected = findSupportedLocale(browserLocales[0], supported);
	if (!saved || saved === detected) return { savedLocale: null, explicit: false, migrated: true };

	return { savedLocale: saved, explicit: true, migrated: true };
};

const safeStorage = () => {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
};

/** Persist a deliberate language choice. Auto-detected values are never saved. */
export const saveExplicitLocale = (locale: string) => {
	const storage = safeStorage();
	try {
		storage?.setItem(LOCALE_STORAGE_KEY, locale);
		storage?.setItem(LOCALE_CHOICE_KEY, 'explicit');
		storage?.setItem(LOCALE_MIGRATED_KEY, '1');
	} catch {
		// Storage can be blocked; the switch still applies for this session.
	}
};

/** Run the one-time migration against localStorage and return the saved locale to honor. */
export const loadSavedLocale = (browserLocales: string[], supportedLocales: SupportedLocales) => {
	const storage = safeStorage();
	if (!storage) return null;
	try {
		const result = migrateLocalePreference({
			savedLocale: storage.getItem(LOCALE_STORAGE_KEY),
			explicit: storage.getItem(LOCALE_CHOICE_KEY) === 'explicit',
			migrated: storage.getItem(LOCALE_MIGRATED_KEY) === '1',
			browserLocales,
			supportedLocales
		});
		if (result.savedLocale === null) storage.removeItem(LOCALE_STORAGE_KEY);
		if (result.explicit) storage.setItem(LOCALE_CHOICE_KEY, 'explicit');
		storage.setItem(LOCALE_MIGRATED_KEY, '1');
		return result.savedLocale;
	} catch {
		return null;
	}
};

/** Remember the deployment default so the next page load can pick the right direction before the config arrives. */
export const rememberDeploymentLocale = (locale?: string | null) => {
	try {
		if (locale) localStorage.setItem(DEPLOYMENT_LOCALE_KEY, locale);
		else localStorage.removeItem(DEPLOYMENT_LOCALE_KEY);
	} catch {
		// ignore
	}
};

export const getLocaleDirection = (locale?: string | null): TextDirection => {
	// i18next owns the language-direction list used by the application. The
	// fallback keeps the bootstrap and unit tests safe before i18next is ready.
	const direction = locale ? i18next.dir(locale) : 'ltr';
	return direction === 'rtl' ? 'rtl' : 'ltr';
};

export const contentDirection = (preference?: 'LTR' | 'RTL' | 'auto' | string | null) => {
	if (preference?.toLowerCase() === 'rtl') return 'rtl';
	if (preference?.toLowerCase() === 'ltr') return 'ltr';
	return 'auto';
};

/** The language the UI is rendering now (not whatever happens to be in storage). */
export const getActiveLocale = () =>
	i18next.language ||
	(typeof document !== 'undefined' ? document.documentElement.lang : '') ||
	FALLBACK_LOCALE;

export const applyDocumentLocale = (locale: string) => {
	if (typeof document === 'undefined') return;
	document.documentElement.lang = locale;
	document.documentElement.dir = getLocaleDirection(locale);
};
