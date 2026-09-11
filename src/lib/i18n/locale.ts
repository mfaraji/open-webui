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

/**
 * Resolve the UI language without mutating storage. Keeping this pure makes the
 * first-visit policy predictable: URL, saved choice, browser, then English.
 */
export const resolveLocale = ({
	queryLocale,
	savedLocale,
	browserLocales = [],
	supportedLocales,
	fallbackLocale = FALLBACK_LOCALE
}: {
	queryLocale?: string | null;
	savedLocale?: string | null;
	browserLocales?: string[];
	supportedLocales: Array<string | LocaleOption>;
	fallbackLocale?: string;
}) => {
	const supported = supportedLocales.map((locale) =>
		typeof locale === 'string' ? locale : locale.code
	);

	for (const candidate of [queryLocale, savedLocale, ...browserLocales]) {
		const match = findSupportedLocale(candidate, supported);
		if (match) return match;
	}

	return findSupportedLocale(fallbackLocale, supported) ?? fallbackLocale;
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

export const applyDocumentLocale = (locale: string) => {
	if (typeof document === 'undefined') return;
	document.documentElement.lang = locale;
	document.documentElement.dir = getLocaleDirection(locale);
};
