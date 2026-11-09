import { describe, expect, it } from 'vitest';

import {
	formatLocalizedNumber,
	formatSolarHijriDate,
	getSolarHijriParts,
	getTimeRangeGroup,
	isPersian,
	localizeDigits,
	relativeTime
} from './persian';

describe('Persian digits', () => {
	it('converts ASCII digits only for Persian', () => {
		expect(localizeDigits(13, 'fa-IR')).toBe('۱۳');
		expect(localizeDigits('7 روز قبل', 'fa')).toBe('۷ روز قبل');
		expect(localizeDigits('13 hours ago', 'en-US')).toBe('13 hours ago');
	});

	it('leaves non-digit text and existing Persian digits alone', () => {
		expect(localizeDigits('report-v۲.pdf', 'fa-IR')).toBe('report-v۲.pdf');
		expect(isPersian('fa_IR')).toBe(true);
		expect(isPersian('en-US')).toBe(false);
		expect(isPersian(undefined)).toBe(false);
	});

	it('formats counters with the right digits', () => {
		expect(formatLocalizedNumber(13, 'fa-IR')).toBe('۱۳');
		expect(formatLocalizedNumber(13, 'en-US')).toBe('13');
	});
});

describe('relative time', () => {
	it('shows Persian digits in Persian and Latin digits in English', () => {
		const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
		expect(relativeTime(thirteenHoursAgo, 'fa-IR')).toMatch(/^۱۳ ساعت.*پیش$/);
		expect(relativeTime(thirteenHoursAgo, 'en-US')).toBe('13 hours ago');
	});
});

describe('Solar Hijri dates', () => {
	it('computes the Persian calendar year and month', () => {
		// 2026-11-09 is 18 Aban 1405
		expect(getSolarHijriParts(new Date('2026-11-09T12:00:00Z'))).toEqual({ year: 1405, month: 8 });
		// Nowruz: 2026-03-21 is 1 Farvardin 1405
		expect(getSolarHijriParts(new Date('2026-03-21T12:00:00Z'))).toEqual({ year: 1405, month: 1 });
	});

	it('formats absolute dates in Persian digits and month names', () => {
		expect(formatSolarHijriDate(new Date('2026-11-09T12:00:00Z'))).toBe('۱۸ آبان ۱۴۰۵');
	});
});

describe('history groups', () => {
	const now = new Date('2026-11-09T12:00:00Z');
	const t = (key: string) => key;
	const secondsAgo = (days: number) => Math.floor((now.getTime() - days * 86400000) / 1000);

	it('keeps stable keys for recent groups', () => {
		expect(getTimeRangeGroup(Math.floor(now.getTime() / 1000), 'fa-IR', t, now).key).toBe('Today');
	});

	it('uses Solar Hijri month names within the current year and years before it', () => {
		const sameYear = getTimeRangeGroup(secondsAgo(120), 'fa-IR', t, now);
		expect(sameYear.key.startsWith('hijri-1405-')).toBe(true);
		expect(sameYear.label).toMatch(/^[آ-ی]+$/);

		const older = getTimeRangeGroup(secondsAgo(500), 'fa-IR', t, now);
		expect(older.key).toBe('hijri-1404');
		expect(older.label).toBe('۱۴۰۴');
	});

	it('keeps Gregorian grouping for English', () => {
		const group = getTimeRangeGroup(secondsAgo(500), 'en-US', t, now);
		expect(group.key).toBe(group.label);
	});
});
