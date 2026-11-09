import { describe, expect, it } from 'vitest';

import {
	buildMessagePreviewDocument,
	classifyHtmlPreview,
	detectTextDirection,
	originalHtmlSource
} from './messagePreview';

// The report fixture, with its original newlines and blank lines.
const REPORT = `📊 <b>گزارش بازار ارز، طلا و نفت</b>
📅 دوشنبه ۱۸ آبان ۱۴۰۵

🇺🇸 دلار آمریکا: <b>۹۲٬۵۰۰ تومان</b>
تغییر: +۱٫۲٪ (USD/IRR)

🛢 نفت خام جهانی
• نفت وست تگزاس (WTI): <b>۶۱٫۴۰ دلار</b>
`;

const group = (html: string, extra: { css?: string; js?: string } = {}) => ({
	html,
	css: '',
	js: '',
	...extra
});

describe('classifyHtmlPreview', () => {
	it('treats the Persian report as an RTL message', () => {
		const result = classifyHtmlPreview(group(REPORT));
		expect(result).toMatchObject({ kind: 'message', direction: 'rtl', explicitDirection: false });
	});

	it('treats an English report as an LTR message', () => {
		const result = classifyHtmlPreview(
			group('📊 <b>Market report</b>\nOil: <i>61.40 USD</i>\n\nGold is up.\n')
		);
		expect(result).toMatchObject({ kind: 'message', direction: 'ltr' });
	});

	it('detects direction from the text, not from Latin tokens inside it', () => {
		expect(detectTextDirection('نرخ USD/IRR و WTI و https://example.com/docs')).toBe('rtl');
		expect(detectTextDirection('Rate for دلار today, see https://example.com')).toBe('ltr');
		expect(detectTextDirection('📊 ٪ 12')).toBe('ltr');
	});

	it('keeps full HTML documents on the standard path', () => {
		expect(
			classifyHtmlPreview(
				group(
					'<!DOCTYPE html><html dir="rtl"><head><style>p{color:red}</style></head><body><p>سلام</p></body></html>'
				)
			).kind
		).toBe('document');
		expect(classifyHtmlPreview(group('<html><body>سلام</body></html>')).kind).toBe('document');
	});

	it('keeps layout, styled, scripted and unknown markup on the standard path', () => {
		for (const html of [
			'<div class="card">سلام</div>',
			'<p>سلام</p><p>دنیا</p>',
			'<h1>گزارش</h1>',
			'<table><tr><td>۱</td></tr></table>',
			'<b style="color:red">سلام</b>',
			'<img src="x.png"> سلام',
			'<button onclick="go()">سلام</button>',
			'<b>سلام',
			'سلام <b>دنیا</i>',
			'<a href="javascript:alert(1)">سلام</a>',
			'<!-- note -->سلام',
			'a < b سلام'
		]) {
			expect(classifyHtmlPreview(group(html)).kind, html).toBe('document');
		}
	});

	it('keeps groups with css or js on the standard path', () => {
		expect(classifyHtmlPreview(group('<b>سلام</b>', { css: 'b{color:red}' })).kind).toBe(
			'document'
		);
		expect(classifyHtmlPreview(group('<b>سلام</b>', { js: 'alert(1)' })).kind).toBe('document');
	});

	it('keeps ambiguous fragments on the standard path', () => {
		expect(classifyHtmlPreview(group('')).kind).toBe('document');
		expect(classifyHtmlPreview(group('<b></b><br>')).kind).toBe('document');
	});

	it('accepts plain text and safe links', () => {
		expect(classifyHtmlPreview(group('سلام\nدنیا')).kind).toBe('message');
		expect(
			classifyHtmlPreview(group('<a href="https://example.com/docs?id=42">لینک</a>')).kind
		).toBe('message');
	});

	it('respects an explicit direction on an outer wrapper and strips the wrapper', () => {
		const rtl = classifyHtmlPreview(group('<div dir="rtl">\nHello <b>world</b>\n</div>'));
		expect(rtl).toMatchObject({ kind: 'message', direction: 'rtl', explicitDirection: true });
		if (rtl.kind === 'message') expect(rtl.body).toBe('Hello <b>world</b>\n');

		const ltr = classifyHtmlPreview(group('<span dir="ltr">گزارش بازار: <b>۶۱٫۴۰</b></span>'));
		expect(ltr).toMatchObject({ kind: 'message', direction: 'ltr', explicitDirection: true });
	});

	it('lets dir="auto" fall back to detection and rejects a wrapper with other attributes', () => {
		expect(classifyHtmlPreview(group('<div dir="auto">سلام دنیا</div>'))).toMatchObject({
			direction: 'rtl',
			explicitDirection: false
		});
		expect(classifyHtmlPreview(group('<div dir="rtl" class="x">سلام</div>')).kind).toBe('document');
	});

	it('allows an explicit direction on an inner inline element', () => {
		expect(classifyHtmlPreview(group('سلام <span dir="ltr">USD/IRR</span> دنیا')).kind).toBe(
			'message'
		);
	});
});

describe('buildMessagePreviewDocument', () => {
	const html = (direction: 'rtl' | 'ltr', fragment = REPORT) =>
		buildMessagePreviewDocument(fragment, { direction });

	it('sets language, direction and a newline-preserving wrapper', () => {
		const doc = html('rtl');
		expect(doc).toContain('<html lang="fa" dir="rtl">');
		expect(doc).toContain('<div class="message" dir="rtl">');
		expect(doc).toContain('white-space:pre-wrap');
		expect(doc).toContain('overflow-wrap:anywhere');
		expect(doc).toContain('text-align:start');
		expect(html('ltr')).toContain('<html lang="en" dir="ltr">');
	});

	it('keeps every line break, blank line and formatting tag of the source', () => {
		const doc = html('rtl');
		const body = doc.slice(doc.indexOf('<div class="message"'), doc.indexOf('</div>'));
		const text = body.replace(/<bdi[^>]*>|<\/bdi>/g, '');
		expect(text).toContain('📊 <b>گزارش بازار ارز، طلا و نفت</b>\n📅 دوشنبه ۱۸ آبان ۱۴۰۵\n\n🇺🇸');
		expect(text).toContain('<b>۹۲٬۵۰۰ تومان</b>\nتغییر: +۱٫۲٪ (USD/IRR)\n\n🛢 نفت خام جهانی\n• ');
	});

	it('isolates signed percentages, currency pairs and parenthesized Latin groups', () => {
		const doc = html('rtl');
		expect(doc).toContain('<bdi dir="ltr" data-technical-value>+۱٫۲٪</bdi>');
		expect(doc).toContain('<bdi dir="ltr" data-technical-value>(USD/IRR)</bdi>');
		expect(doc).toContain('<bdi dir="ltr" data-technical-value>(WTI)</bdi>');
	});

	it('never touches tag markup when isolating text', () => {
		const doc = html(
			'rtl',
			'<a href="https://example.com/docs?id=42">لینک</a> https://example.com/x'
		);
		expect(doc).toContain('<a href="https://example.com/docs?id=42">لینک</a>');
		expect(doc).toContain('<bdi dir="ltr" data-technical-value>https://example.com/x</bdi>');
	});

	it('uses Vazirmatn with a fallback stack and the supplied theme colors', () => {
		const doc = buildMessagePreviewDocument('سلام', {
			direction: 'rtl',
			fontUrl: 'https://owui.example/assets/fonts/Vazirmatn-Variable.ttf',
			colors: { background: '#1c2120', text: '#ecefec', colorScheme: 'dark' }
		});
		expect(doc).toContain("@font-face{font-family:'Vazirmatn'");
		expect(doc).toContain(
			"local('Vazirmatn'),url('https://owui.example/assets/fonts/Vazirmatn-Variable.ttf')"
		);
		expect(doc).toContain("font-family:'Vazirmatn','Vazir','Noto Naskh Arabic','Segoe UI',Tahoma");
		expect(doc).toContain('background:#1c2120;color:#ecefec');
		expect(doc).toContain('color-scheme:dark');
	});

	it('does not define the font face when no font URL is available', () => {
		expect(html('rtl')).not.toContain('@font-face');
	});

	it('keeps the layout narrow-friendly', () => {
		const doc = html('rtl');
		expect(doc).toContain('max-width:100%;overflow-x:hidden');
		expect(doc).toContain('width=device-width');
	});
});

describe('originalHtmlSource', () => {
	it('removes only the newlines added by block extraction', () => {
		expect(originalHtmlSource('📊 <b>گزارش</b>\nخط دوم\n\n')).toBe('📊 <b>گزارش</b>\nخط دوم');
		expect(originalHtmlSource('سلام\n')).toBe('سلام');
		expect(originalHtmlSource('خط اول\n\nخط سوم\n\n')).toBe('خط اول\n\nخط سوم');
	});
});
