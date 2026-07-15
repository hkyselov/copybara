# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Copybara is a macOS-first Electron clipboard manager (menu-bar app, no dock icon). Package name
`copybara`, product name `Copybara`, distributed as an ad-hoc-signed universal `.dmg` (the only
maker configured in forge.config.js) via GitHub Releases.

## Commands

```bash
npm install        # install deps (see "Electron install gotcha" below)
npm start          # electron-forge start — runs the app in dev
npm run package    # electron-forge package — build unpacked app
npm run make       # electron-forge make — build the .dmg
npm run mac        # make for darwin, universal arch
```

There is no test suite and no linter configured (`npm run lint` is a no-op placeholder).

### Electron install gotcha

`node_modules/electron`'s postinstall (`extract-zip`) can silently hang/truncate while unpacking
`Electron.app` on newer Node versions, exiting 0 without ever writing `node_modules/electron/path.txt`.
Symptom: `Error: Electron failed to install correctly, please delete node_modules/electron and try
installing again`. If reinstalling doesn't fix it, extract the cached zip manually and let
`install.js` skip re-downloading:

```bash
rm -rf node_modules/electron/dist node_modules/electron/path.txt
ZIP=$(find ~/Library/Caches/electron -name "electron-v*.zip" | head -1)
unzip -q "$ZIP" -d node_modules/electron/dist
echo -n "Electron.app/Contents/MacOS/Electron" > node_modules/electron/path.txt
xattr -cr node_modules/electron/dist/Electron.app
```

The same `extract-zip` bug used to kill `npm run mac`/`npm run make` silently (exit 0, no `out/`)
while unpacking the Electron zips during packaging; the `overrides` entry in package.json pins
`extract-zip` to `@electron-internal/extract-zip` (Electron's native fork) to fix that — don't
remove it.

## Architecture

This is a multi-window Electron app where the main process owns the clipboard-watching state
machine, plus a set of lightweight UI windows that talk to it over IPC. There is no bundler config
of note beyond electron-forge defaults; renderer JS is loaded straight from `src/html/*.html`.

- **`src/main.js`** — the main process. Owns all app-level state: `windowPinned`, auto-hide
  timing, tray, global shortcut, and Store-backed settings (`electron-store`). Every
  cross-window interaction is proxied through `ipcMain` handlers here — windows never talk to
  each other directly. Wires the clipboard manager's callbacks (`initClipboardManager`) to the
  main window / clip-info window on startup.
- **`src/utils/clipboardManager.js`** — main-process module that owns `clipboardHistory` (single
  source of truth) and the actual clipboard poller, using Electron's main-process `clipboard`
  API (the `clipboard` module is deprecated in renderers). It self-schedules via
  `setTimeout(clipboardListener, 300)` — a 300ms poll loop, not an event — and diffs the
  current OS clipboard against the last entry to decide whether to push a new history item
  (handles `html`, `text`, and `image` clip types differently, including resizing images to a
  256px thumbnail and truncating text values to 256 chars for display). Exposes
  `removeClip`/`pinClip`/`selectClip`/`getClipInfo`/`getClipboardHistory` for `main.js`'s ipc
  handlers; history entries keep the full `raw` payload internally but are stripped of `raw`
  before being emitted to any window.
- **Main window** (`createWindow` in `main.js` + `src/html/index.html` + `src/renderer/renderer.js`
  + `src/renderer/clip-item.js`) — the popup clipboard list. Frameless, transparent, always-on-top,
  starts at `opacity: 0`/hidden and is faded in/out via `showWindow`/`hideWindow` in
  `src/utils/utils.js` rather than normal show/hide. Auto-hides on blur/move/resize/mouse-idle
  unless `windowPinned`; timing driven by `autoHideWindow()` in `main.js` using the
  `autoHideDelayTime` setting.
- **Settings window** (`src/utils/createSettingWindow.js` + `src/html/settings.html` +
  `src/renderer/settings.js`) and **clip-info window** (`src/utils/createClipInfoWindow.js` +
  `src/html/clip-info.html` + `src/renderer/clip-info.js`) — singleton on-demand windows (module-
  level `settingWindow`/`clipInfoWindow` variable, closed and recreated rather than reused).
- **`src/preload.js`** — the only IPC surface exposed to renderers (all of which are
  context-isolated), via `contextBridge.exposeInMainWorld("electronAPI", ...)`. Used by the main,
  settings, and clip-info windows.
- **`src/utils/tray.js`** — menu-bar icon + context menu (Open Clipboard / Preferences / Quit).
- **`src/utils/defaultSettings.js`** — shape and defaults for the `electron-store` settings blob
  (`openAtLogin`, `autoHideWindow`, `autoHideDelayTime`, `openClipboardShortcut`). Settings changes
  flow: renderer → `settings:save-settings` ipc → `main.js` switch-on-key handler → `Store.set` +
  any side effect (re-registering the global shortcut, updating login-item settings, etc.).
- **`src/renderer/keys.js`** — `KeyboardEvent.code` → display glyph/accelerator-name lookup table,
  used by the settings UI for recording a custom global shortcut.

### IPC channel map (main ⇄ main window)

Clips flow one way at a time: `clipboardManager.js` (detects clip) → `onNewClip`/`onHistoryChange`
callbacks in `main.js` → `update-clipboard` → main window (a single-clip payload appends one item;
an array payload replaces the whole list). Actions on a clip go the other way: main window →
`remove-clip`/`pin-clip`/`select-clip`/`clip-info` ipc → `main.js` → direct calls into
`clipboardManager`, which mutates the history and, on select, actually writes the clip back to the
OS clipboard.

### Packaging / signing (forge.config.js)

Builds are ad-hoc signed (`identity: "-"`, no Apple Developer account): required for the app to
launch on Apple Silicon at all, with hardened runtime off because an ad-hoc (team-less) process
fails library validation when loading the ad-hoc-signed Electron Framework. There is no
notarization — downloaded builds trigger Gatekeeper's "Open Anyway" flow, and TCC permission
grants (Accessibility) may reset between updates since ad-hoc signatures carry no stable identity.
Electron Fuses are configured to disable `RunAsNode`/Node CLI inspect/Node options env var and
enforce ASAR integrity — packaged builds cannot be run with arbitrary Node flags.
