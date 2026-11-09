/**
 * Bidirectional-text helpers for mixed Persian/English content.
 *
 * `splitTechnicalValues` only describes where isolation should be applied; the
 * concatenation of the returned segments is always exactly the input, so the
 * rendered text, selection and clipboard never change.
 */

export type TextSegment = { text: string; technical: boolean };

const ARABIC_SCRIPT = /[֐-ࣿיִ-﷿ﹰ-﻿]/;

const TECHNICAL = new RegExp(
	[
		// URLs
		String.raw`https?:\/\/[^\s<>"'‌]+`,
		// e-mail addresses
		String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+`,
		// Latin identifiers with internal separators: USD/IRR, gpt-4.1, report-v2.pdf
		String.raw`[A-Za-z][A-Za-z0-9]*(?:[-./_:][A-Za-z0-9]+)+`,
		// Parenthesized Latin groups so the brackets stay paired around them: (WTI), (USD/IRR)
		String.raw`\([A-Za-z][A-Za-z0-9 ./_:-]*\)`,
		// Signed or percent figures, in any digit set: +۱٫۲٪, -3.5%, ±0.4%
		String.raw`[+\-\u2212\u00b1]?[0-9\u06f0-\u06f9\u0660-\u0669]+(?:[.,\u066b\u066c][0-9\u06f0-\u06f9\u0660-\u0669]+)*\s?[%\u066a]`,
		String.raw`[+\u2212\u00b1][0-9\u06f0-\u06f9\u0660-\u0669]+(?:[.,\u066b\u066c][0-9\u06f0-\u06f9\u0660-\u0669]+)*`
	].join('|'),
	'g'
);

// Sentence punctuation that follows a URL belongs to the sentence, not the link.
const TRAILING_PUNCTUATION = /[.,;:!?)\]'"،؛؟]+$/;

export const hasArabicScript = (text: string) => ARABIC_SCRIPT.test(text);

export const splitTechnicalValues = (text: string): TextSegment[] => {
	const segments: TextSegment[] = [];
	let cursor = 0;

	for (const match of text.matchAll(TECHNICAL)) {
		let value = match[0];
		const start = match.index ?? 0;
		if (/^https?:/i.test(value)) value = value.replace(TRAILING_PUNCTUATION, '');
		if (!value) continue;

		if (start > cursor) segments.push({ text: text.slice(cursor, start), technical: false });
		segments.push({ text: value, technical: true });
		cursor = start + value.length;
	}

	if (cursor < text.length) segments.push({ text: text.slice(cursor), technical: false });
	return segments.length ? segments : [{ text, technical: false }];
};

/**
 * Segments to render for a piece of text. Text without Arabic-script characters
 * is returned as a single plain segment, so English content is untouched.
 */
export const isolationSegments = (text: string): TextSegment[] =>
	hasArabicScript(text) ? splitTechnicalValues(text) : [{ text, technical: false }];
