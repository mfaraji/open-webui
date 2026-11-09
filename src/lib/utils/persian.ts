import dayjs from 'dayjs';
import { getDayjsLocale } from '$lib/dayjs';
import { getTimeRange } from '$lib/utils';
import { isPersian, localizeDigits } from '$lib/utils/digits';

/**
 * Display-layer helpers for Persian. They only change how UI-generated numbers
 * and dates are shown; stored timestamps, IDs, filenames, URLs, code and
 * user-authored text are never passed through them.
 */

export { isPersian, localizeDigits };

/** Count-style numbers shown by the UI, e.g. "۱۳" or "۱٫۲K". */
export const formatLocalizedNumber = (
	value: number,
	lang?: string | null,
	options: Intl.NumberFormatOptions = {}
) => new Intl.NumberFormat(isPersian(lang) ? 'fa-IR' : 'en-US', options).format(value);

/** Relative time such as "۱۳ ساعت پیش". `value` is anything dayjs accepts (ms, Date, ISO). */
export const relativeTime = (value: dayjs.ConfigType, lang?: string | null) =>
	localizeDigits(
		dayjs(value)
			.locale(getDayjsLocale(lang ?? 'en-US'))
			.fromNow(),
		lang
	);

const PERSIAN_CALENDAR = 'fa-IR-u-ca-persian';

/** Solar Hijri year and month (1-12) for a date, computed with the platform calendar. */
export const getSolarHijriParts = (date: Date) => {
	const parts = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
		year: 'numeric',
		month: 'numeric'
	}).formatToParts(date);
	const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
	return { year: read('year'), month: read('month') };
};

/** Absolute date in the Persian calendar, e.g. "۱۸ آبان ۱۴۰۵". */
export const formatSolarHijriDate = (
	value: dayjs.ConfigType,
	options?: Intl.DateTimeFormatOptions
) =>
	new Intl.DateTimeFormat(
		PERSIAN_CALENDAR,
		options ?? { day: 'numeric', month: 'long', year: 'numeric' }
	).format(dayjs(value).toDate());

export type TimeRangeGroup = { key: string; label: string };

/**
 * Sidebar history group for a chat. Today / Yesterday / previous 7 and 30 days
 * keep the stable keys. Older chats are bucketed by Solar Hijri month (this
 * year) or year in Persian, and by Gregorian month or year otherwise.
 */
export const getTimeRangeGroup = (
	timestamp: number,
	lang: string | null | undefined,
	t: (key: string) => string,
	now: Date = new Date()
): TimeRangeGroup => {
	const key = getTimeRange(timestamp);
	if (!isPersian(lang)) return { key, label: t(key) };

	const fixed = ['Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days'];
	if (fixed.includes(key)) return { key, label: localizeDigits(t(key), lang) };

	const date = new Date(timestamp * 1000);
	const chat = getSolarHijriParts(date);
	const today = getSolarHijriParts(now);

	if (chat.year === today.year) {
		return {
			key: `hijri-${chat.year}-${chat.month}`,
			label: new Intl.DateTimeFormat(PERSIAN_CALENDAR, { month: 'long' }).format(date)
		};
	}
	return {
		key: `hijri-${chat.year}`,
		label: new Intl.DateTimeFormat(PERSIAN_CALENDAR, { year: 'numeric' }).format(date)
	};
};

/** History group for a chat row; falls back to the stored `time_range` when no timestamp is available. */
export const chatTimeGroup = (
	chat: { updated_at?: number | null; time_range?: string } | null | undefined,
	lang: string | null | undefined,
	t: (key: string) => string
): TimeRangeGroup =>
	chat?.updated_at != null
		? getTimeRangeGroup(chat.updated_at, lang, t)
		: { key: chat?.time_range ?? '', label: chat?.time_range ? t(chat.time_range) : '' };
