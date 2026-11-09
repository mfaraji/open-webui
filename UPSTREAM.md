# Upstream maintenance

`origin` is the Ashpazi fork (`mfaraji/open-webui`) and `upstream` is official Open WebUI. This fork is currently based on `v0.11.3` plus these Ashpazi commits:

- `1cf40b72e` build: raise Node heap limit for frontend build
- `5e01fe603` feat: add PWA install prompt
- `0cbb77d8e` feat: add server-side Google Drive integration via workspace MCP gateway

## Updating to a release

Create `upgrade/open-webui-vX.Y.Z`, then fetch and merge the tag without rewriting published history:

```sh
git fetch upstream --tags
git switch -c upgrade/open-webui-vX.Y.Z main
git merge --no-ff vX.Y.Z
```

Never rebase published `main`. During a conflict, accept new upstream behavior first and then reapply the smallest Ashpazi presentation or integration patch needed.

## Patch inventory and hotspots

- Build-memory configuration can conflict with package scripts and Docker build setup.
- PWA install prompt and asset mounting can conflict with manifests, static assets, service workers, and app layout startup.
- Google Drive gateway changes can conflict with server config, integration settings, user-forwarding headers, and backend APIs.
- Persian-first patches touch locale startup, `app.html`, `tailwind.css`, `app.css`, chat direction, shared controls, and local icons.
- Persian-first redesign (branch `feat/persian-first-redesign`), one commit per concern so a conflict can be resolved by reapplying that concern only:
  - Locale: `i18n/locale.ts`, `i18n/index.ts`, `app.html`, `routes/+layout.svelte` (URL, explicit saved choice, deployment default, browser; no auto-caching; one-time migration), `LanguageToggle.svelte`. Needs `DEFAULT_LOCALE=fa-IR` in the deployment.
  - Theme tokens: `app.css`, `app.html` splash/theme-color, `theme/contrast.test.ts` (WCAG checks read the tokens from `app.css`).
  - RTL shell: `Sidebar.svelte` (logical edges, resize, drawer Escape/focus), `MobileSwipePanel.svelte`, `Dropdown.svelte` (direction-aware alignment, arrow keys, menu roles), logical Tailwind utilities across the chat journey.
  - Chat/composer/sidebar: `Placeholder.svelte`, `Suggestions.svelte`, `MessageInput.svelte` toolbar, `Sidebar.svelte` hierarchy. Upstream's hero model name and shuffled suggestions are replaced here.
  - Digits/dates: `utils/digits.ts`, `utils/persian.ts`, a single `dayjs.prototype.fromNow` patch in `utils/index.ts`, history group labels via `chatTimeGroup`.
  - Bidi: `utils/bidi.ts`, `Markdown*Tokens*`, `ResponseMessage.svelte` row direction.
  - Search: `utils/search_text.py` plus `routers/search.py` and `models/chats.py` matching (Persian/Arabic variants, half-spaces); tests in `backend/tests`.
  - HTML preview: `utils/messagePreview.ts`, `Artifacts.svelte`, and the `getContents` branch in `Chat.svelte`.
  - Assistant naming: `utils/modelNames.ts` (Dana/دانا default, picker aliases) used by `ResponseMessage.svelte`, the model picker and a few chat components.
- Do not statically alias or change Telegram, scheduling, automation or gateway code for presentation work; none of the above touches them.

When a patch changes upstream behavior, document the new baseline in this file and preserve a focused commit per concern where practical.

## Required regression checks

Run `npm run check`, `npm run test:frontend`, `npx eslint . --no-fix`, and `npm run build`. Smoke-test Persian and English at mobile and desktop widths in light, dark, and OLED modes: authentication, chat/composer, mixed-language Markdown/code, sidebar, settings, workspace/admin, dialogs/menus, Drive attachment, and PWA installation.

After deployment, verify through TLS that `/manifest.json`, `/static/web-app-manifest-512x512.png`, and `/.well-known/assetlinks.json` return the expected Ashpazi assets. Do not statically alias Open WebUI-owned manifest or icon routes from the private deployment directory.
