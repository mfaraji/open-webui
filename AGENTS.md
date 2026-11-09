# Ashpazi Open WebUI contributor guide

This repository is the Ashpazi fork of Open WebUI. Keep changes narrow and compatible with upstream's Svelte frontend and Python backend; do not replace application structure or backend APIs for presentation work.

## Daily commands

- `npm run check` validates Svelte and TypeScript.
- `npm run test:frontend` runs Vitest.
- `npm run build` produces the frontend build.
- Use `npx eslint . --no-fix` for a non-writing frontend lint check.

## Persian and RTL

- Locale priority is URL `?lang`, saved `locale`, browser languages, then `en-US`.
- Use `$lib/i18n/locale` to resolve/apply a locale. It updates both `html[lang]` and `html[dir]`.
- Content remains `dir="auto"` unless the existing chat-direction preference explicitly requests LTR or RTL.
- Prefer logical CSS/Tailwind start/end utilities (`ps`, `pe`, `ms`, `me`, `start`, `end`) over physical left/right. Keep code, IDs, URLs, paths, terminal output, previews, calendars, and image controls in isolated LTR containers.
- Wrap mixed dynamic technical values with bidi isolation where punctuation can reorder.

## Theme and icons

- Use semantic `--color-*` tokens in `tailwind.css` and Ashpazi variables in `app.css`; retain gray aliases because upstream components use them heavily.
- Palette: warm ivory canvas, white elevated surfaces, charcoal text and a single deep-teal accent (`--ashpazi-primary`) for primary actions, focus and selected items. Saffron is only for warnings/highlights. Pomegranate is retired. `src/lib/theme/contrast.test.ts` reads the tokens from `app.css` and enforces WCAG contrast in light, dark and OLED, so change colors there and keep it green. Do not replace provider brands, status colors, syntax themes, or calendar user colors.
- Reuse local SVG icons. Standard navigation icons are 24px `currentColor`, rounded 1.75px strokes, and directional icons carry `data-directional-icon` for RTL mirroring.
- Prefer `common/IconButton.svelte` for new compact action controls. Supply an accessible label; standard render sizes are 16, 20, and 24px.

## Boundaries

- Preserve Open WebUI branding and license notices. Do not add external font or icon dependencies.
- PWA `/manifest.json` and manifest icons are Open WebUI-owned. The deployment mounts Ashpazi assets into Open WebUI; nginx serves only the copied Digital Asset Links file.
- Never commit credentials, API keys, user data, `.env` files, or generated production artifacts.
- Keep Ashpazi patches independently understandable so release merges can accept upstream behavior first, then reapply the presentation change.

## Assistant and model names

- The default assistant above replies is "Dana" / "دانا" (the `Dana` translation key). A model with a configured name (a custom assistant, or a base model renamed in Workspace > Models) keeps that name. See `src/lib/utils/modelNames.ts`.
- The model picker shows configured names, then `MODEL_DISPLAY_ALIASES` for raw IDs (currently `gemini-4-argon` → Gemini), then the raw ID. The exact ID stays in tooltips, accessible names, the per-reply details and picker search. Add aliases there, not in components.
- Attribution comes from `message.model` on each reply, so switching models never rewrites earlier replies.
