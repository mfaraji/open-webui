// Standalone (no imports) so low-level modules can use it without import cycles.

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const isPersian = (lang?: string | null) =>
	(lang ?? '').toLowerCase().split(/[-_]/)[0] === 'fa';

/** Convert ASCII digits to Persian digits when the UI language is Persian. */
export const localizeDigits = (value: string | number, lang?: string | null) => {
	const text = String(value);
	return isPersian(lang) ? text.replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]) : text;
};
