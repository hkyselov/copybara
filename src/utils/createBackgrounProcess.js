import { BrowserWindow } from "electron";
import { getClipboardHistory } from "../main.js";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

export function createBackgrounProcess(closed) {
  const bgProcess = new BrowserWindow({
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  bgProcess.on("closed", () => closed());

  bgProcess.loadFile(path.join(__dirname, `../html/background.html`));

  bgProcess.webContents.on("did-finish-load", () => {
    bgProcess.webContents.send("set-clipboard-history", getClipboardHistory());
    bgProcess.webContents.send("start-clipboard-listener");
  });

  //   bgProcess.webContents.openDevTools();
  return bgProcess;
}
