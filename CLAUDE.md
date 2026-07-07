# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Copybara is a macOS-first Electron clipboard manager (menu-bar app, no dock icon). Package name
`copybara`, product name `Copybara`, packaged for the Mac App Store (`platform: "mas"` in
forge.config.js) as well as zip/deb/rpm/squirrel targets.

## Commands

```bash
npm install        # install deps (see "Electron install gotcha" below)
npm start           # electron-forge start — runs the app in dev
npm run package     # electron-forge package — build unpacked app
npm run make        # electron-forge make — build platform installers/artifacts
npm run mac         # make for darwin, universal arch
npm run mas         # make for the Mac App Store target, universal arch
npm run mas-release # BUILD_TYPE=release npm run mas — uses release signing identity/profile
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

## Architecture

This is a multi-process/multi-window Electron app built around one always-running hidden
"background" renderer that owns the actual clipboard-watching state machine, plus a set of
lightweight UI windows that talk to it only through the main process. There is no bundler config
of note beyond electron-forge defaults; renderer JS is loaded straight from `src/html/*.html`.

- **`src/main.js`** — the main process. Owns all app-level state: `clipboardHistory` (single
  source of truth, kept in sync from the background process on unload), `windowPinned`,
  auto-hide timing, tray, global shortcut, and Store-backed settings (`electron-store`). Every
  cross-window interaction is proxied through `ipcMain` handlers here — windows never talk to
  each other directly.
- **`src/utils/createBackgrounProcess.js`** — creates a hidden, always-alive `BrowserWindow`
  loading `src/html/background.html` → `src/renderer/background.js`. This is the actual clipboard
  poller: `nodeIntegration: true`, `contextIsolation: false` (deliberately, unlike every other
  window), so it can use Node's `crypto` and Electron's `clipboard` API directly. It self-schedules
  via `setTimeout(clipboardListener, 300)` — a 300ms poll loop, not an event — and diffs the
  current OS clipboard against the last entry to decide whether to push a new history item
  (handles `html`, `text`, and `image` clip types differently, including resizing images to a
  256px thumbnail and truncating text values to 256 chars for display).
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
- **`src/preload.js`** — the only IPC surface exposed to context-isolated renderers, via
  `contextBridge.exposeInMainWorld("electronAPI", ...)`. Used by the main, settings, and clip-info
  windows. The background window bypasses this entirely since it has direct `ipcRenderer`/Node
  access.
- **`src/utils/tray.js`** — menu-bar icon + context menu (Open Clipboard / Preferences / Quit).
- **`src/utils/defaultSettings.js`** — shape and defaults for the `electron-store` settings blob
  (`openAtLogin`, `autoHideWindow`, `autoHideDelayTime`, `openClipboardShortcut`). Settings changes
  flow: renderer → `settings:save-settings` ipc → `main.js` switch-on-key handler → `Store.set` +
  any side effect (re-registering the global shortcut, updating login-item settings, etc.).
- **`src/renderer/keys.js`** — `KeyboardEvent.code` → display glyph/accelerator-name lookup table,
  used by the settings UI for recording a custom global shortcut.

### IPC channel map (main ⇄ background ⇄ main window)

Clips flow one way at a time and never directly between renderers:
`background.js` (detects clip) → `new-clip`/`clipboard-history` → `main.js` (updates
`clipboardHistory`) → `update-clipboard` → main window. Actions on a clip (remove/pin/select) go
the other way: main window → `remove-clip`/`pin-clip`/`select-clip` → `main.js` → forwarded to
`bgProcess` as `remove-clip`/`pin-clip`/`select-clip` for it to mutate its own history and, on
select, actually write the clip back to the OS clipboard.

### Packaging / signing (forge.config.js)

Two signing identities selected via `BUILD_TYPE` env var (`ForgeUtils().fromBuildIdentity`):
`dev` (Apple Development identity + `Profile_Dev.provisionprofile`, hardened runtime on) vs
`release` (Apple Distribution identity + `Profile_Distribution.provisionprofile`, hardened runtime
off). Entitlements file picked per-file (`entitlements.mas.inherit.plist` for anything inside
`.app/`, otherwise `entitlements.mas.plist`) — neither the entitlements plists nor the
`.provisionprofile` files are checked into this repo; they must be supplied locally to make/sign a
`mas` build. Electron Fuses are configured to disable `RunAsNode`/Node CLI inspect/Node options env
var and enforce ASAR integrity — packaged builds cannot be run with arbitrary Node flags.
