import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  nativeTheme,
  screen,
} from "electron";
import path from "path";
import Store from "electron-store";
import { defaultSettings } from "./utils/defaultSettings.js";
import { hideWindow, showWindow } from "./utils/utils.js";
import {
  isAccessibilityTrusted,
  pasteInFrontmostApp,
} from "./utils/macAutomation.js";
import {
  initClipboardManager,
  startClipboardListener,
  removeClip,
  pinClip,
  selectClip,
  getClipInfo,
  getClipboardHistory,
} from "./utils/clipboardManager.js";
import {
  createClipInfoWindow,
  setInfoWindowBackgroundColor,
} from "./utils/createClipInfoWindow.js";
import {
  createSettingWindow,
  loadSettings,
  setSettingsWindowBackgroundColor,
} from "./utils/createSettingWindow.js";

import { createTray } from "./utils/tray.js";

import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow;
let windowPinned = false;
let hideWindowTimeout;
let settings;
let autoHideWindowSetting;
let accessibilityPromptShown = false;
let lastSetPosition = null;
let saveWindowPositionTimeout;

const backgroundColor = () =>
  nativeTheme.shouldUseDarkColors
    ? "rgba(42, 42, 42, 0.95)"
    : "rgba(232, 232, 232, 0.95)";

const gotTheLock = app.requestSingleInstanceLock();

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    //center: true,
    minWidth: 250,
    minHeight: 408,
    width: 250,
    height: 408,
    minimizable: false,
    maximizable: false,
    transparent: true,
    resizable: true,
    backgroundColor: backgroundColor(),
    //closable: false,
    alwaysOnTop: true,
    fullscreenable: false,
    fullscreen: false,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    opacity: 0,
    show: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.on("closed", () => (mainWindow = null));

  mainWindow.loadFile(path.join(__dirname, `./html/index.html`));

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send("update-clipboard", getClipboardHistory());
    mainWindow.webContents.send("update-window-pin", windowPinned);
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
  mainWindow.on("blur", () => {
    if (!windowPinned) hideWindow(mainWindow);
  });

  mainWindow.on("move", () => {
    autoHideWindow();
    saveWindowPositionSoon();
  });

  mainWindow.on("resize", () => {
    autoHideWindow();
  });

  mainWindow.webContents.on("input-event", (event, input) => {
    const { type } = input;
    if (type === "mouseMove" || type === "mouseWheel") autoHideWindow();
  });
};

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      showWindow(mainWindow);
      autoHideWindow();
    }
  });
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    app.dock.hide();
    if (!settings) {
      settings = new Store({
        defaults: defaultSettings,
      });
    }
    app.setLoginItemSettings({ openAtLogin: settings.get("openAtLogin") });
    autoHideWindowSetting = settings.get("autoHideWindow");

    createTray(
      () => {
        showWindow(mainWindow);
        autoHideWindow();
      },
      () => {
        createSettingWindow(backgroundColor);
      }
    );

    registerShortcut();

    ipcMain.on("remove-clip", (event, uuid) => {
      removeClip(uuid);
    });

    ipcMain.on("pin-clip", (event, uuid, pin) => {
      pinClip(uuid, pin);
    });

    ipcMain.on("select-clip", (event, uuid) => {
      selectClip(uuid);
      if (!windowPinned) hideWindow(mainWindow);
      if (settings.get("pasteOnSelect")) {
        if (!isAccessibilityTrusted(false)) {
          promptAccessibilityOncePerRun();
          yieldFocus();
          return;
        }
        yieldFocus();
        setTimeout(() => {
          pasteInFrontmostApp();
        }, 120);
      } else if (windowPinned) {
        yieldFocus();
      }
    });

    ipcMain.on("hide-window", () => {
      if (!windowPinned) {
        hideWindow(mainWindow);
        app.hide();
      }
    });

    ipcMain.on("pin-window", (event, pin) => {
      windowPinned = pin;
    });

    ipcMain.on("clip-info", (event, uuid) => {
      getClipInfo(uuid);
    });

    ipcMain.on("prevent-auto-hide", () => {
      autoHideWindow();
    });

    ipcMain.on("settings:save-settings", (event, key, value) => {
      if (key === "openAtLogin") {
        settings.set("openAtLogin", value);
        app.setLoginItemSettings({ openAtLogin: value });
      }
      if (key === "autoHideWindow") {
        settings.set("autoHideWindow", value);
        autoHideWindowSetting = value;
      }
      if (key === "autoHideDelayTime") {
        settings.set("autoHideDelayTime", value);
        autoHideWindow();
      }

      if (key === "pasteOnSelect") {
        settings.set("pasteOnSelect", value);
        if (value) isAccessibilityTrusted(true);
      }

      if (key === "openClipboardShortcut") {
        if (value) {
          settings.set("openClipboardShortcut", value);
          registerShortcut();
        } else {
          unRegisterShortcut();
          settings.set("openClipboardShortcut", value);
        }
      }

      if (key === "restoreToDefault") {
        unRegisterShortcut();
        settings.store = defaultSettings;
        registerShortcut();
        app.setLoginItemSettings({ openAtLogin: settings.get("openAtLogin") });
        autoHideWindowSetting = settings.get("autoHideWindow");
        autoHideWindow();
        loadSettings();
      }
    });

    nativeTheme.on("updated", () => {
      if (mainWindow) {
        mainWindow.setBackgroundColor(backgroundColor());
      }
      setInfoWindowBackgroundColor(backgroundColor());
      setSettingsWindowBackgroundColor(backgroundColor());
    });

    initClipboardManager({
      onNewClip: (clip) => {
        mainWindow?.webContents.send("update-clipboard", clip);
      },
      onHistoryChange: (history) => {
        mainWindow?.webContents.send("update-clipboard", history);
      },
      onShowClipInfo: (clip) => {
        createClipInfoWindow(clip, backgroundColor);
      },
    });
    createWindow();
    startClipboardListener();
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  // Unregister a shortcut.
  unRegisterShortcut();

  // Unregister all shortcuts.
  //globalShortcut.unregisterAll()
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function unRegisterShortcut() {
  const openClipboardShortcutSettings = settings.get("openClipboardShortcut");
  if (openClipboardShortcutSettings) {
    globalShortcut.unregister(openClipboardShortcutSettings.accelerator);
  }
}

function registerShortcut() {
  const openClipboardShortcutSettings = settings.get("openClipboardShortcut");
  if (openClipboardShortcutSettings) {
    const ret = globalShortcut.register(
      openClipboardShortcutSettings.accelerator,
      openClipboard
    );
    if (!ret) {
      console.log("registration failed");
    }
  }
}

function openClipboard() {
  if (mainWindow?.isFocused() && mainWindow?.isVisible()) {
    mainWindow?.webContents.send("next-clip");
  } else {
    positionWindow();
    showWindow(mainWindow);
    autoHideWindow();
  }
}

// Debounced from the window's "move" events: once the window settles, remember
// where the user dragged it — per display, so each screen keeps its own spot.
// Moves caused by our own setPosition land exactly on lastSetPosition and are
// skipped.
function saveWindowPositionSoon() {
  clearTimeout(saveWindowPositionTimeout);
  saveWindowPositionTimeout = setTimeout(() => {
    if (!mainWindow) return;
    const [x, y] = mainWindow.getPosition();
    if (lastSetPosition && lastSetPosition.x === x && lastSetPosition.y === y)
      return;
    const [width, height] = mainWindow.getSize();
    const display = screen.getDisplayMatching({ x, y, width, height });
    const positions = settings.get("windowPositions") ?? {};
    positions[display.id] = { x, y };
    settings.set("windowPositions", positions);
  }, 300);
}

function positionWindow() {
  if (!mainWindow || windowPinned) return; // don't yank a pinned window around
  const [w, h] = mainWindow.getSize();
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { workArea: a } = display;
  const saved = (settings.get("windowPositions") ?? {})[display.id];
  // Reuse this display's remembered spot only while it still overlaps the
  // display (its resolution/arrangement may have changed since).
  const savedVisible =
    saved &&
    saved.x < a.x + a.width &&
    saved.x + w > a.x &&
    saved.y < a.y + a.height &&
    saved.y + h > a.y;
  let x, y;
  if (savedVisible) {
    ({ x, y } = saved);
  } else {
    // Default: horizontally centered, upper third of the screen the cursor
    // is on — one predictable spot, Spotlight-style.
    x = Math.round(a.x + (a.width - w) / 2);
    y = Math.round(a.y + (a.height - h) * 0.25);
  }
  lastSetPosition = { x, y };
  mainWindow.setPosition(x, y);
}

// Hand focus back to whatever app was active before the popup. app.hide()
// pops macOS's own activation stack, so we don't have to track the previous
// app ourselves; when pinned, immediately re-show the window without
// re-taking focus so it stays on screen.
function yieldFocus() {
  app.hide();
  if (windowPinned && mainWindow) {
    mainWindow.showInactive();
  }
}

// The Accessibility prompt is shown at most once per run; pasteOnSelect
// defaults to on, so first-time users would otherwise never see it.
function promptAccessibilityOncePerRun() {
  if (accessibilityPromptShown) return;
  accessibilityPromptShown = true;
  isAccessibilityTrusted(true);
}

function autoHideWindow() {
  if (hideWindowTimeout) {
    clearInterval(hideWindowTimeout);
    hideWindowTimeout = null;
  }

  hideWindowTimeout = setTimeout(() => {
    if (!windowPinned) {
      if (autoHideWindowSetting) {
        // Auto-hide never selects: merely navigating to a clip with the
        // shortcut and letting the window disappear must not rewrite the OS
        // clipboard. Only an explicit Enter/click selects (and pastes).
        hideWindow(mainWindow);
      }
    }
    autoHideWindow();
  }, 1000 * settings.get("autoHideDelayTime"));
}

export function getSettings() {
  return settings?.store;
}
