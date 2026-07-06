import { Tray, Menu } from "electron";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createTray(openClipboardWindow, openSettingsWindow) {
  const tray = new Tray(
    path.join(__dirname, "../images/trayCopybaraMTemplate.png")
  );

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Clipboard",
      click: openClipboardWindow,
    },
    { type: "separator" },
    {
      label: "Preferences...",
      click: openSettingsWindow,
    },
    {
      label: "Rate App",
      click: () => console.log("Rate the App"),
    },
    { type: "separator" },
    {
      label: "Quit",
      role: "quit",
      accelerator: "Cmd+Q",
    },
  ]);

  tray.setToolTip("Copybara");
  tray.setContextMenu(contextMenu);
}
