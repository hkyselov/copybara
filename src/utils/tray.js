import { Tray, Menu, shell } from "electron";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray;
let menuActions;
let availableUpdate = null;

export function createTray(openClipboardWindow, openSettingsWindow) {
  tray = new Tray(
    path.join(__dirname, "../images/trayCopybaraMTemplate.png")
  );

  menuActions = { openClipboardWindow, openSettingsWindow };
  tray.setToolTip("Copybara");
  rebuildMenu();
}

export function setTrayUpdateAvailable(update) {
  availableUpdate = update;
  if (tray) rebuildMenu();
}

function rebuildMenu() {
  const template = [
    {
      label: "Open Clipboard",
      click: menuActions.openClipboardWindow,
    },
    { type: "separator" },
    {
      label: "Preferences...",
      click: menuActions.openSettingsWindow,
    },
    {
      label: "Rate App",
      click: () => console.log("Rate the App"),
    },
  ];

  if (availableUpdate) {
    template.push(
      { type: "separator" },
      {
        label: `Download Copybara v${availableUpdate.version}...`,
        click: () => shell.openExternal(availableUpdate.url),
      }
    );
  }

  template.push(
    { type: "separator" },
    {
      label: "Quit",
      role: "quit",
      accelerator: "Cmd+Q",
    }
  );

  tray.setContextMenu(Menu.buildFromTemplate(template));
}
