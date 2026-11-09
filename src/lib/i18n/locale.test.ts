import { describe, expect, it } from 'vitest';

import {
	contentDirection,
	getLocaleDirection,
	migrateLocalePreference,
	resolveLocale
} from './locale';

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

	it('uses the deployment default before the browser language', () => {
		expect(
			resolveLocale({ deploymentLocale: 'fa-IR', browserLocales: ['en-US'], supportedLocales })
		).toBe('fa-IR');
		expect(resolveLocale({ deploymentLocale: '', browserLocales: ['fr'], supportedLocales })).toBe(
			'fr-FR'
		);
	});

	it('lets a saved choice and the URL beat the deployment default', () => {
		expect(
			resolveLocale({ savedLocale: 'en-US', deploymentLocale: 'fa-IR', supportedLocales })
		).toBe('en-US');
		expect(
			resolveLocale({
				queryLocale: 'fr-FR',
				savedLocale: 'en-US',
				deploymentLocale: 'fa-IR',
				supportedLocales
			})
		).toBe('fr-FR');
	});
});

describe('locale migration', () => {
	const base = { browserLocales: ['en-US'], supportedLocales };

	it('drops a saved locale that only mirrors the browser language', () => {
		expect(migrateLocalePreference({ ...base, savedLocale: 'en-US' })).toEqual({
			savedLocale: null,
			explicit: false,
			migrated: true
		});
	});

	it('keeps a saved locale that differs from the browser as an explicit choice', () => {
		expect(migrateLocalePreference({ ...base, savedLocale: 'fr-FR' })).toEqual({
			savedLocale: 'fr-FR',
			explicit: true,
			migrated: true
		});
	});

	it('never touches an explicit choice, even one equal to the browser language', () => {
		expect(migrateLocalePreference({ ...base, savedLocale: 'en-US', explicit: true })).toEqual({
			savedLocale: 'en-US',
			explicit: true,
			migrated: true
		});
	});

	it('does nothing after the first run', () => {
		expect(
			migrateLocalePreference({ ...base, savedLocale: 'en-US', migrated: true }).savedLocale
		).toBe('en-US');
		expect(migrateLocalePreference({ ...base }).savedLocale).toBeNull();
	});
});
