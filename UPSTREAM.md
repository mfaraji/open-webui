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

When a patch changes upstream behavior, document the new baseline in this file and preserve a focused commit per concern where practical.

## Required regression checks

Run `npm run check`, `npm run test:frontend`, `npx eslint . --no-fix`, and `npm run build`. Smoke-test Persian and English at mobile and desktop widths in light, dark, and OLED modes: authentication, chat/composer, mixed-language Markdown/code, sidebar, settings, workspace/admin, dialogs/menus, Drive attachment, and PWA installation.

After deployment, verify through TLS that `/manifest.json`, `/static/web-app-manifest-512x512.png`, and `/.well-known/assetlinks.json` return the expected Ashpazi assets. Do not statically alias Open WebUI-owned manifest or icon routes from the private deployment directory.
