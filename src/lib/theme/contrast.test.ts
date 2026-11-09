import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Reads the real tokens out of app.css so the palette has one source of truth,
 * then checks WCAG contrast for the text/background pairs the UI relies on.
 */
const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');

const block = (selector: string) => {
	const start = css.indexOf(`${selector} {`);
	if (start === -1) throw new Error(`Missing ${selector} block in app.css`);
	return css.slice(start, css.indexOf('\n}', start));
};

const tokens = (selector: string) =>
	Object.fromEntries(
		[...block(selector).matchAll(/--ashpazi-([a-z-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((m) => [
			m[1],
			m[2]
		])
	) as Record<string, string>;

const expand = (hex: string) =>
	hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;

const luminance = (hex: string) => {
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(expand(hex).slice(i, i + 2), 16) / 255)
		.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string) => {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

const themes = {
	light: tokens(':root'),
	dark: { ...tokens(':root'), ...tokens('.dark') },
	oled: { ...tokens(':root'), ...tokens('.dark'), ...tokens(".dark[data-theme='oled']") }
};

describe.each(Object.entries(themes))('%s theme contrast', (_name, t) => {
	it('defines the spec palette tokens', () => {
		for (const key of ['canvas', 'surface', 'text', 'muted', 'primary', 'on-primary', 'focus']) {
			expect(t[key], key).toBeTruthy();
		}
	});

	it.each([
		['text', 'canvas'],
		['text', 'surface'],
		['text', 'elevated'],
		['muted', 'canvas'],
		['muted', 'surface'],
		['primary', 'canvas'],
		['primary', 'surface'],
		['on-primary', 'primary'],
		['text', 'selected'],
		['danger', 'surface'],
		['warning', 'surface']
	])('%s on %s meets 4.5:1', (fg, bg) => {
		expect(contrast(t[fg], t[bg]), `${fg} ${t[fg]} on ${bg} ${t[bg]}`).toBeGreaterThanOrEqual(4.5);
	});

	it('gives the composer outline 3:1 against the canvas and the surface', () => {
		expect(contrast(t.outline, t.canvas)).toBeGreaterThanOrEqual(3);
		expect(contrast(t.outline, t.surface)).toBeGreaterThanOrEqual(3);
	});

	it('keeps the focus ring and borders perceivable (3:1 for focus)', () => {
		expect(contrast(t.focus, t.canvas)).toBeGreaterThanOrEqual(3);
		expect(contrast(t.focus, t.surface)).toBeGreaterThanOrEqual(3);
	});
});

it('uses the specified light palette', () => {
	expect(themes.light).toMatchObject({
		canvas: '#f8f6f1',
		surface: '#ffffff',
		text: '#202624',
		primary: '#0f6b60'
	});
});
