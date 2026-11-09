import { describe, expect, it } from 'vitest';

import { assistantName, hasConfiguredName, modelPickerName, modelWithId } from './modelNames';

const t = (language: string) => (key: string) =>
	key === 'Dana' && language === 'fa' ? 'دانا' : key;

const base = { id: 'gemini-4-argon', name: 'gemini-4-argon' };
const flash = { id: 'gemini-3.8-flash', name: 'gemini-3.8-flash' };
const renamedBase = {
	id: 'gemini-4-argon',
	name: 'Gemini Pro',
	info: { name: 'Gemini Pro', base_model_id: null }
};
const custom = {
	id: 'mario',
	name: 'Mario',
	info: { name: 'Mario', base_model_id: 'gemini-4-argon' }
};

describe('assistantName', () => {
	it('uses Dana in English and دانا in Persian for the default assistant', () => {
		expect(assistantName(base, 'en-US', t('en'))).toBe('Dana');
		expect(assistantName(base, 'fa-IR', t('fa'))).toBe('دانا');
		expect(assistantName(undefined, 'fa-IR', t('fa'))).toBe('دانا');
	});

	it('shows the configured name of a custom assistant in both languages', () => {
		expect(assistantName(custom, 'en-US', t('en'))).toBe('Mario');
		expect(assistantName(custom, 'fa-IR', t('fa'))).toBe('Mario');
	});

	it('treats a configured name on a base model as a configured name', () => {
		expect(hasConfiguredName(renamedBase)).toBe(true);
		expect(assistantName(renamedBase, 'en-US', t('en'))).toBe('Gemini Pro');
	});

	it('does not treat a raw connection ID as a configured name', () => {
		expect(hasConfiguredName(base)).toBe(false);
		expect(
			hasConfiguredName({ ...base, info: { name: 'gemini-4-argon', base_model_id: null } })
		).toBe(false);
	});
});

describe('modelPickerName', () => {
	it('shows gemini-4-argon as Gemini and leaves other raw IDs alone', () => {
		expect(modelPickerName(base, 'en-US')).toBe('Gemini');
		expect(modelPickerName(base, 'fa-IR')).toBe('Gemini');
		expect(modelPickerName(flash, 'en-US')).toBe('gemini-3.8-flash');
	});

	it('lets a configured name win over the alias', () => {
		expect(modelPickerName(renamedBase, 'en-US')).toBe('Gemini Pro');
		expect(modelPickerName(custom, 'en-US')).toBe('Mario');
	});
});

describe('modelWithId', () => {
	it('keeps the exact ID next to the label', () => {
		expect(modelWithId(base, 'gemini-4-argon', 'en-US')).toBe('Gemini (gemini-4-argon)');
		expect(modelWithId(flash, 'gemini-3.8-flash', 'en-US')).toBe('gemini-3.8-flash');
		expect(modelWithId(undefined, 'removed-model', 'en-US')).toBe('removed-model');
	});
});
