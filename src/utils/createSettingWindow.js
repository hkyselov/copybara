import { BrowserWindow } from "electron";
import { hideWindow, showWindow } from "./utils.js";
import { getSettings } from "../main.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

let settingWindow;

export function createSettingWindow(backgroundColor) {
  const isWindowOpened = () =>
    settingWindow &&
    !settingWindow.isDestroyed() &&
    settingWindow.isFocusable();
  if (isWindowOpened()) {
    hideWindow(settingWindow, true);
    settingWindow = null;
  }

  // Create the browser window.
  settingWindow = new BrowserWindow({
    titleBarStyle: "hidden",
    minWidth: 400,
    minHeight: 400,
    width: 400,
    height: 400,
    alwaysOnTop: true,
    opacity: 0,
    show: false,
    backgroundColor: backgroundColor(),
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
    },
  });

  settingWindow.once("ready-to-show", () => {
    showWindow(settingWindow);
  });
  settingWindow.loadFile(path.join(__dirname, `../html/settings.html`));

  settingWindow.webContents.on("did-finish-load", () => {
    settingWindow?.webContents.send("settings:load-settings", getSettings());
  });

  // clipInfoWindow.on("close", () => console.log("Close Info window"));
  settingWindow.on("closed", () => {
    if (!isWindowOpened()) {
      settingWindow = null;
    }
  });

  // Open the DevTools.
  //settingWindow.webContents.openDevTools();
}

export function loadSettings() {
  settingWindow?.webContents.send("settings:load-settings", getSettings());
}

export function setSettingsWindowBackgroundColor(color) {
  settingWindow?.setBackgroundColor(color);
}
