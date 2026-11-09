import { describe, expect, it } from 'vitest';

import { hasArabicScript, isolationSegments, splitTechnicalValues } from './bidi';

const FIXTURE =
	'لطفاً Gemini 2.5 Pro رو با GPT-4.1 مقایسه کن. فایل report-v2.pdf و لینک https://example.com/docs?id=42 رو هم بررسی کن و نتیجه رو در ۳ خط بنویس.';

const technical = (text: string) =>
	splitTechnicalValues(text)
		.filter((s) => s.technical)
		.map((s) => s.text);

describe('technical value isolation', () => {
	it('finds model IDs, filenames and URLs in the mixed fixture', () => {
		expect(technical(FIXTURE)).toEqual([
			'GPT-4.1',
			'report-v2.pdf',
			'https://example.com/docs?id=42'
		]);
	});

	it('never changes the text: segments always join back to the input', () => {
		for (const text of [
			FIXTURE,
			'نرخ USD/IRR امروز (WTI): +۱٫۲٪',
			'ایمیل: team@example.com.',
			'',
			'فقط فارسی'
		]) {
			expect(
				splitTechnicalValues(text)
					.map((s) => s.text)
					.join('')
			).toBe(text);
		}
	});

	it('keeps sentence punctuation out of a trailing URL', () => {
		expect(technical('لینک https://example.com/a، و https://example.com/b.')).toEqual([
			'https://example.com/a',
			'https://example.com/b'
		]);
	});

	it('isolates currency pairs but not plain words or numbers', () => {
		expect(technical('نرخ USD/IRR برای WTI و 2.5 برابر')).toEqual(['USD/IRR']);
	});

	it('leaves text without Arabic script untouched', () => {
		expect(isolationSegments('Open report-v2.pdf now')).toEqual([
			{ text: 'Open report-v2.pdf now', technical: false }
		]);
		expect(hasArabicScript('report')).toBe(false);
		expect(hasArabicScript('گزارش')).toBe(true);
	});
});
