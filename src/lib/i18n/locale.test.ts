import { describe, expect, it } from 'vitest';

import { contentDirection, getLocaleDirection, resolveLocale } from './locale';

const supportedLocales = ['en-US', 'fa-IR', 'ar', 'fr-FR'];

describe('locale resolution', () => {
	it('prefers a URL override over saved and browser locales', () => {
		expect(
			resolveLocale({
				queryLocale: 'en-US',
				savedLocale: 'fa-IR',
				browserLocales: ['fa-IR'],
				supportedLocales
			})
		).toBe('en-US');
	});

	it('uses a saved preference before the browser language', () => {
		expect(
			resolveLocale({
				savedLocale: 'fa-IR',
				browserLocales: ['en-US'],
				supportedLocales
			})
		).toBe('fa-IR');
	});

	it('matches language-only browser locales and falls back to English', () => {
		expect(resolveLocale({ browserLocales: ['fa'], supportedLocales })).toBe('fa-IR');
		expect(resolveLocale({ browserLocales: ['zz'], supportedLocales })).toBe('en-US');
	});

	it('uses correct document and content directions', () => {
		expect(getLocaleDirection('fa-IR')).toBe('rtl');
		expect(getLocaleDirection('en-US')).toBe('ltr');
		expect(contentDirection('RTL')).toBe('rtl');
		expect(contentDirection('LTR')).toBe('ltr');
		expect(contentDirection('auto')).toBe('auto');
	});
});
