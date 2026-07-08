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

// Queries the caret rect of the focused text field via the Accessibility API:
// AXFocusedUIElement -> AXSelectedTextRange -> AXBoundsForRange. AXValue structs
// can't be marshaled through the JXA ObjC bridge, so the rect is parsed out of
// CFCopyDescription output ("{value = x:614 y:475 w:1 h:18} type = kAXValueCGRectType").
const CARET_JXA = `
ObjC.import('Cocoa');
ObjC.import('ApplicationServices');
ObjC.bindFunction('AXUIElementCreateSystemWide', ['id', []]);
ObjC.bindFunction('AXUIElementCopyAttributeValue', ['int', ['id', 'id', 'id*']]);
ObjC.bindFunction('AXUIElementCopyParameterizedAttributeValue', ['int', ['id', 'id', 'id', 'id*']]);
ObjC.bindFunction('CFCopyDescription', ['id', ['id']]);
function run() {
  const systemWide = $.AXUIElementCreateSystemWide();
  const el = Ref();
  if ($.AXUIElementCopyAttributeValue(systemWide, 'AXFocusedUIElement', el) !== 0) return '';
  const range = Ref();
  if ($.AXUIElementCopyAttributeValue(el[0], 'AXSelectedTextRange', range) !== 0) return '';
  const bounds = Ref();
  if ($.AXUIElementCopyParameterizedAttributeValue(el[0], 'AXBoundsForRange', range[0], bounds) !== 0) return '';
  const desc = ObjC.unwrap($.CFCopyDescription(bounds[0]));
  const m = desc.match(/x:([-\\d.]+) y:([-\\d.]+) w:([-\\d.]+) h:([-\\d.]+)/);
  if (!m) return '';
  return JSON.stringify({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] });
}
`;

// Resolves to a screen point just below the text caret, or null when it can't
// be determined (no Accessibility permission, app with broken AX support,
// secure input field, or the osascript spawn exceeding timeoutMs — its
// cold start is ~100-300ms, so the caller trades up to timeoutMs of popup
// latency for caret-accurate placement).
export function getCaretPoint(timeoutMs = 350) {
  return new Promise((resolve) => {
    if (!isAccessibilityTrusted(false)) return resolve(null);
    const child = execFile(
      "osascript",
      ["-l", "JavaScript", "-e", CARET_JXA],
      { timeout: timeoutMs + 500 },
      (err, stdout) => {
        clearTimeout(timer);
        if (err || !stdout.trim()) return resolve(null);
        try {
          const r = JSON.parse(stdout);
          // Some apps report a bogus 0,0 rect; treat it as "no caret".
          if (!r || (r.x === 0 && r.y === 0)) return resolve(null);
          // AX coordinates are top-left-origin global, matching Electron's
          // screen coordinate space on macOS.
          resolve({ x: Math.round(r.x), y: Math.round(r.y + r.h) });
        } catch {
          resolve(null);
        }
      }
    );
    const timer = setTimeout(() => {
      child.kill();
      resolve(null);
    }, timeoutMs);
  });
}
