export const defaultSettings = {
  openAtLogin: true,
  appearance: "system",
  autoHideWindow: true,
  autoHideDelayTime: 3,
  clipDisplayLines: 1,
  clipFontSize: 14,
  pasteOnSelect: true,
  // Where the popup opens, keyed by display id. A display with no entry uses
  // the default: centered in the upper third of that screen. An entry is
  // written when the user drags the window somewhere on that display.
  windowPositions: {},
  openClipboardShortcut: {
    accelerator: "Command+Option+x",
    display: "⌥⌘X",
  },
};
