# Contributing to Copybara

Thanks for your interest! Contributions of all kinds are welcome — bug reports, feature ideas, and pull requests.

## Development setup

```bash
git clone https://github.com/hkyselov/copybara.git
cd copybara
npm install
npm start
```

Requires Node.js 22+ and macOS (the app is macOS-only — it uses the menu bar, Accessibility APIs, and macOS-specific window behavior).

### If `npm install` leaves Electron broken

Electron's postinstall can silently fail to unpack `Electron.app` on some Node versions — the symptom is `Error: Electron failed to install correctly` when running `npm start`. If reinstalling doesn't fix it, unpack the cached zip manually:

```bash
rm -rf node_modules/electron/dist node_modules/electron/path.txt
ZIP=$(find ~/Library/Caches/electron -name "electron-v*.zip" | head -1)
unzip -q "$ZIP" -d node_modules/electron/dist
echo -n "Electron.app/Contents/MacOS/Electron" > node_modules/electron/path.txt
xattr -cr node_modules/electron/dist/Electron.app
```

Related: the `overrides` entry in `package.json` pins `extract-zip` to Electron's fork — it fixes the same bug during packaging, so please don't remove it.

## Project layout in one paragraph

The main process ([src/main.js](src/main.js)) owns all state — settings, the tray, the global shortcut, and the clipboard-watching poller in [src/utils/clipboardManager.js](src/utils/clipboardManager.js). The UI windows (clipboard popup, settings, clip info) are lightweight renderers that talk to the main process exclusively over IPC, with [src/preload.js](src/preload.js) as the only exposed surface. If you're adding a setting, follow the existing flow: `defaultSettings.js` → settings window HTML/JS → `settings:save-settings` handler in `main.js`.

## Pull requests

- Branch from `main`; keep PRs focused on one change.
- There's no test suite yet — CI verifies the app still packages into a `.dmg`. Please run `npm start` and exercise your change by hand before opening a PR, and say in the description what you checked.
- Match the existing code style (plain ESM, no bundler, no framework in renderers).

## Building a distributable

```bash
npm run mac   # universal .dmg in out/make/
```

Builds are ad-hoc signed (no Apple Developer account required) — see the README for what that means for Gatekeeper.
