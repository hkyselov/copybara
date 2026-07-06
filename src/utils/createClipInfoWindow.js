import { BrowserWindow } from "electron";
import { hideWindow, showWindow } from "./utils.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

let clipInfoWindow;

export function createClipInfoWindow(clip, backgroundColor) {
  const isWindowOpened = () =>
    clipInfoWindow &&
    !clipInfoWindow.isDestroyed() &&
    clipInfoWindow.isFocusable();
  if (isWindowOpened()) {
    hideWindow(clipInfoWindow, true);
    clipInfoWindow = null;
  }

  // Create the browser window.
  clipInfoWindow = new BrowserWindow({
    //center: true,
    alwaysOnTop: true,
    opacity: 0,
    show: false,
    backgroundColor: backgroundColor(),
    //center: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
    },
  });

  clipInfoWindow.once("ready-to-show", () => {
    showWindow(clipInfoWindow);
  });

  clipInfoWindow.loadFile(path.join(__dirname, `../html/clip-info.html`));

  clipInfoWindow.webContents.on("did-finish-load", () => {
    clipInfoWindow?.webContents.send("update-clip-info", clip);
  });

  clipInfoWindow.on("closed", () => {
    if (!isWindowOpened()) {
      clipInfoWindow = null;
    }
  });

  // Open the DevTools.
  //clipInfoWindow.webContents.openDevTools();
}

export function setInfoWindowBackgroundColor(color) {
  clipInfoWindow?.setBackgroundColor(color);
}
