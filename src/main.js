import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  nativeTheme,
} from "electron";
import path from "path";
import Store from "electron-store";
import { defaultSettings } from "./utils/defaultSettings.js";
import { hideWindow, showWindow } from "./utils/utils.js";
import { createBackgrounProcess } from "./utils/createBackgrounProcess.js";
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
let bgProcess;
let clipboardHistory = [];
let windowPinned = false;
let hideWindowTimeout;
let settings;
let autoHideWindowSetting;

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
    console.log("restat Main");
    mainWindow.webContents.send("update-clipboard", clipboardHistory);
    mainWindow.webContents.send("update-window-pin", windowPinned);
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
  mainWindow.on("blur", () => {
    if (!windowPinned) hideWindow(mainWindow);
  });

  mainWindow.on("move", () => {
    autoHideWindow();
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
      bgProcess.webContents.send("remove-clip", uuid);
    });

    ipcMain.on("pin-clip", (event, uuid, pin) => {
      bgProcess.webContents.send("pin-clip", uuid, pin);
    });

    ipcMain.on("select-clip", (event, uuid) => {
      bgProcess?.webContents.send("select-clip", uuid);
      if (!windowPinned) hideWindow(mainWindow);
    });

    ipcMain.on("new-clip", (event, clip) => {
      const { raw, ...rest } = clip;
      mainWindow?.webContents.send("update-clipboard", rest);
    });

    ipcMain.on("clipboard-history", (event, history) => {
      console.log("unload: ", history);
      clipboardHistory = history;
      mainWindow?.webContents.send("update-clipboard", history);
    });

    ipcMain.on("pin-window", (event, pin) => {
      windowPinned = pin;
    });

    ipcMain.on("clip-info", (event, uuid) => {
      bgProcess?.webContents.send("get-clip-info", uuid);
    });

    ipcMain.on("show-clip-info", (event, clip) => {
      createClipInfoWindow(clip, backgroundColor);
    });

    ipcMain.on("prevent-auto-hide", (event, uuid) => {
      autoHideWindow(uuid);
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

    bgProcess = createBackgrounProcess(() => (bgProcess = null));
    createWindow();
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
    bgProcess = createBackgrounProcess(() => (bgProcess = null));
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
    showWindow(mainWindow);
    autoHideWindow();
  }
}

function autoHideWindow(uuid) {
  if (hideWindowTimeout) {
    clearInterval(hideWindowTimeout);
    hideWindowTimeout = null;
  }

  hideWindowTimeout = setTimeout(() => {
    if (!windowPinned) {
      if (autoHideWindowSetting) {
        hideWindow(mainWindow);
        if (uuid) bgProcess?.webContents.send("select-clip", uuid, true);
      }
    }
    autoHideWindow();
  }, 1000 * settings.get("autoHideDelayTime"));
}

export function getClipboardHistory() {
  return clipboardHistory;
}

export function getSettings() {
  return settings?.store;
}
