/**
 * Message-style HTML preview.
 *
 * A fenced `html` block is usually a web artifact, but it can also be a chat
 * message template (Telegram-style): text with `<b>`/`<i>` and plain newlines.
 * Browsers collapse those newlines and lay the text out left-to-right in an
 * English document, which ruins a Persian report. This module decides which
 * fragments are message-like and builds a dedicated wrapper for them.
 *
 * Anything that is not clearly a message (full documents, styles, scripts,
 * layout elements, unknown attributes) stays on the standard preview path.
 */

import { hasArabicScript, splitTechnicalValues } from '$lib/utils/bidi';

export type MessageDirection = 'rtl' | 'ltr';

export type PreviewClassification =
	| {
			kind: 'message';
			direction: MessageDirection;
			explicitDirection: boolean;
			/** The markup to render: the fragment without an outer direction wrapper. */
			body: string;
	  }
	| { kind: 'document' };

// Inline formatting a message template may use (Telegram's HTML subset plus <u>/<s> aliases).
const INLINE_TAGS = new Set([
	'b',
	'strong',
	'i',
	'em',
	'u',
	'ins',
	's',
	'strike',
	'del',
	'code',
	'pre',
	'a',
	'br',
	'span',
	'bdi',
	'blockquote',
	'tg-spoiler'
]);

// An outer wrapper may carry an explicit direction (and language), nothing else.
const WRAPPER = /^\s*<(div|p|section|span)((?:\s+[^<>]*?)?)\s*>([\s\S]*)<\/\1\s*>\s*$/i;

const SAFE_HREF = /^(https?:|mailto:|tel:|tg:)/i;
const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g;
const ATTRIBUTE = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

// Letters only: the Arabic script block also holds digits and signs (٪ ٫ ۱), which are not words.
const ARABIC_WORD = /(?:(?=\p{L})\p{Script=Arabic})+/gu;
const LATIN_WORD = /(?:(?=\p{L})\p{Script=Latin})+/gu;

const attributesOf = (raw: string) => {
	const found: Record<string, string> = {};
	for (const match of raw.matchAll(ATTRIBUTE)) {
		found[match[1].toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? '';
	}
	return found;
};

const stripTags = (html: string) => html.replace(/<[^>]*>/g, '');

const decodeBasicEntities = (text: string) =>
	text
		.replace(/&nbsp;/g, ' ')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');

/**
 * Direction from the message text, independent of the app language. Words are counted by
 * script; URLs, e-mails, identifiers (USD/IRR) and ticker-style capitals (WTI) carry no
 * language and are ignored. The script with more words wins; a tie goes to the first word.
 */
export const detectTextDirection = (html: string): MessageDirection => {
	const text = decodeBasicEntities(stripTags(html))
		.replace(/https?:\/\/\S+/gi, ' ')
		.replace(/\S+@\S+\.\S+/g, ' ')
		.replace(/[A-Za-z][A-Za-z0-9]*(?:[-./_:][A-Za-z0-9]+)+/g, ' ')
		.replace(/\b[A-Z]{2,6}\b/g, ' ');

	const arabic = text.match(ARABIC_WORD)?.length ?? 0;
	const latin = text.match(LATIN_WORD)?.length ?? 0;

	if (arabic === latin) {
		const first = text.search(new RegExp(`${ARABIC_WORD.source}|${LATIN_WORD.source}`, 'u'));
		return first !== -1 && /\p{Script=Arabic}/u.test(text[first]) ? 'rtl' : 'ltr';
	}
	return arabic > latin ? 'rtl' : 'ltr';
};

// True when the markup is only supported inline formatting with safe attributes and balanced tags.
const isInlineMarkup = (html: string) => {
	const stack: string[] = [];
	let rest = '';
	let lastEnd = 0;

	for (const match of html.matchAll(TAG)) {
		const [whole, closing, rawName, rawAttrs, selfClosing] = match;
		const name = rawName.toLowerCase();
		const index = match.index ?? 0;
		rest += html.slice(lastEnd, index);
		lastEnd = index + whole.length;

		if (!INLINE_TAGS.has(name)) return false; // layout, media, forms, style, script ...
		if (closing) {
			if (stack.pop() !== name) return false; // unbalanced markup is ambiguous
			continue;
		}

		for (const [key, value] of Object.entries(attributesOf(rawAttrs))) {
			if (key === 'href' && name === 'a' && SAFE_HREF.test(value.trim())) continue;
			if ((key === 'dir' || key === 'lang') && name !== 'a') continue;
			if (key === 'class' && name === 'code' && /^language-[\w-]+$/.test(value)) continue;
			return false; // style, class, id, event handlers and anything else
		}
		if (!selfClosing && name !== 'br') stack.push(name);
	}

	rest += html.slice(lastEnd);
	// A stray "<" is markup we did not understand.
	return stack.length === 0 && !rest.includes('<');
};

/**
 * Decide whether an HTML group is a message fragment. `css` and `js` come from the
 * sibling code blocks of the same group; if either is present it is a web artifact.
 */
export const classifyHtmlPreview = (group: {
	html: string;
	css?: string;
	js?: string;
}): PreviewClassification => {
	const html = group.html ?? '';
	const document: PreviewClassification = { kind: 'document' };

	if (group.css?.trim() || group.js?.trim()) return document;
	if (!stripTags(html).trim()) return document;
	if (/<!|<\?/.test(html)) return document; // doctype, comments, processing instructions

	let body = html;
	let explicit: MessageDirection | null = null;

	const wrapper = WRAPPER.exec(html);
	if (wrapper) {
		const attrs = attributesOf(wrapper[2]);
		const names = Object.keys(attrs);
		if (names.length > 0 && names.every((name) => name === 'dir' || name === 'lang')) {
			const direction = attrs.dir?.toLowerCase();
			if (direction === 'rtl' || direction === 'ltr') explicit = direction;
			body = wrapper[3];
		}
	}

	if (!isInlineMarkup(body)) return document;

	return {
		kind: 'message',
		direction: explicit ?? detectTextDirection(body),
		explicitDirection: explicit !== null,
		// Like <pre>, ignore one newline right after an opening wrapper tag.
		body: body.replace(/^\r?\n/, '')
	};
};

export type PreviewColors = {
	background: string;
	text: string;
	muted: string;
	link: string;
	border: string;
	colorScheme: 'light' | 'dark';
};

export const DEFAULT_PREVIEW_COLORS: PreviewColors = {
	background: '#ffffff',
	text: '#202624',
	muted: '#5d6662',
	link: '#0f6b60',
	border: '#e2ddd3',
	colorScheme: 'light'
};

const escapeHtml = (text: string) =>
	text
		.replace(/&(?!#?\w+;)/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

// Wrap bidi-fragile runs of text in isolated spans. Only text between tags is touched;
// tags, attributes and the characters themselves are left exactly as written. Decided from
// the whole message, so a chunk of Latin text between two tags is still isolated.
const isolateTextRuns = (html: string) => {
	if (!hasArabicScript(stripTags(html))) return html;
	return html
		.split(/(<[^>]*>)/)
		.map((part) => {
			if (part.startsWith('<') && part.endsWith('>')) return part;
			return splitTechnicalValues(part)
				.map((segment) =>
					segment.technical
						? `<bdi dir="ltr" data-technical-value>${segment.text}</bdi>`
						: segment.text
				)
				.join('');
		})
		.join('');
};

export type MessagePreviewOptions = {
	direction: MessageDirection;
	colors?: Partial<PreviewColors>;
	/** Absolute URL of the Vazirmatn font file, when the host can serve it. */
	fontUrl?: string;
};

/**
 * Build the srcdoc for a message fragment. The fragment itself is inserted verbatim
 * (it was already validated by `classifyHtmlPreview`); the host keeps using the same
 * sandbox and content-security policy as every other preview.
 */
export const buildMessagePreviewDocument = (
	fragment: string,
	{ direction, colors = {}, fontUrl }: MessagePreviewOptions
) => {
	const c = { ...DEFAULT_PREVIEW_COLORS, ...colors };
	const lang = direction === 'rtl' ? 'fa' : 'en';
	const body = isolateTextRuns(fragment.replace(/\s+$/, ''));
	const fontFace = fontUrl
		? `@font-face{font-family:'Vazirmatn';src:local('Vazirmatn'),url('${escapeHtml(fontUrl).replace(/'/g, '%27')}') format('truetype');font-weight:100 900;font-display:swap}`
		: '';

	return `<!DOCTYPE html>
<html lang="${lang}" dir="${direction}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${fontFace}
:root{color-scheme:${c.colorScheme}}
*{box-sizing:border-box}
html,body{margin:0;max-width:100%;overflow-x:hidden;background:${c.background};color:${c.text}}
body{font-family:'Vazirmatn','Vazir','Noto Naskh Arabic','Segoe UI',Tahoma,'DejaVu Sans',ui-sans-serif,system-ui,sans-serif;font-size:16px}
.message{padding:16px 18px;line-height:1.9;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;text-align:start}
.message b,.message strong{font-weight:700}
.message i,.message em{font-style:italic}
.message u,.message ins{text-decoration:underline}
.message s,.message strike,.message del{text-decoration:line-through}
.message a{color:${c.link};text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
.message code,.message pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;direction:ltr;unicode-bidi:isolate;font-size:.92em}
.message pre{display:block;margin:.5em 0;padding:.6em .8em;border:1px solid ${c.border};border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left}
.message blockquote{display:block;margin:.5em 0;padding-inline-start:.9em;border-inline-start:3px solid ${c.border};color:${c.muted}}
.message tg-spoiler{background:${c.border};border-radius:4px;padding:0 .25em}
[data-technical-value]{unicode-bidi:isolate}
</style>
</head>
<body>
<div class="message" dir="${direction}">${body}</div>
</body>
</html>`;
};

/**
 * `getCodeBlockContents` appends a newline to each html block and the block text itself
 * keeps the newline before its closing fence. Remove exactly those two so Copy returns the
 * payload as written in the code block.
 */
export const originalHtmlSource = (html: string) =>
	html.endsWith('\n\n') ? html.slice(0, -2) : html.replace(/\n$/, '');
