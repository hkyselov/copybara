import { execFile } from "node:child_process";
import { systemPreferences } from "electron";

export function isAccessibilityTrusted(prompt = false) {
  return (
    process.platform === "darwin" &&
    systemPreferences.isTrustedAccessibilityClient(prompt)
  );
}

export function pasteInFrontmostApp() {
  return new Promise((resolve) => {
    execFile(
      "osascript",
      [
        "-e",
        'tell application "System Events" to keystroke "v" using command down',
      ],
      { timeout: 2000 },
      (error) => resolve(!error)
    );
  });
}