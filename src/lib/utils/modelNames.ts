import { resolveLocalizedModelName } from '$lib/utils/localizedContent';

/**
 * Friendly picker names for raw model IDs that have no configured display name.
 * A name configured in Workspace > Models always wins over this table, and the exact
 * ID stays visible in model details and searchable in the picker.
 */
export const MODEL_DISPLAY_ALIASES: Record<string, string> = {
	'gemini-4-argon': 'Gemini'
};

type ModelLike = {
	id?: string;
	name?: string;
	info?: { name?: string; base_model_id?: string | null; meta?: unknown } | null;
	meta?: unknown;
} | null;

/** A name the admin or user set on the model (as opposed to the connection's raw ID). */
export const hasConfiguredName = (model: ModelLike | undefined) => {
	const info = model?.info;
	if (!info) return false;
	if (info.base_model_id) return true; // a custom assistant built on a base model
	return !!info.name && info.name !== model?.id;
};

/** Name shown in the model picker: configured name, then the alias for a raw ID, then the ID. */
export const modelPickerName = (model: ModelLike | undefined, locale?: string | null) => {
	const resolved = resolveLocalizedModelName(model, locale) as string;
	const id = model?.id ?? '';
	if (!hasConfiguredName(model) && (!resolved || resolved === id)) {
		return MODEL_DISPLAY_ALIASES[id.toLowerCase()] ?? resolved;
	}
	return resolved;
};

/**
 * Assistant name above a reply. The default assistant is "Dana" / "دانا" (translated, so it
 * follows the UI language); a custom assistant with a configured name keeps its own name.
 */
export const assistantName = (
	model: ModelLike | undefined,
	locale: string | null | undefined,
	t: (key: string) => string
) => {
	if (hasConfiguredName(model)) {
		const configured = resolveLocalizedModelName(model, locale) as string;
		if (configured) return configured;
	}
	return t('Dana');
};

/** "Gemini (gemini-4-argon)" — the label plus the exact ID, or just the ID when they match. */
export const modelWithId = (
	model: ModelLike | undefined,
	fallbackId: string,
	locale?: string | null
) => {
	const id = model?.id ?? fallbackId ?? '';
	const label = model ? modelPickerName(model, locale) : id;
	return label && label !== id ? `${label} (${id})` : id;
};

export const escapeHtmlText = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
