import { app, Notification, shell } from "electron";

const LATEST_RELEASE_API_URL =
  "https://api.github.com/repos/hkyselov/copybara/releases/latest";
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
// Don't compete with startup work (clipboard poller, window creation).
const FIRST_CHECK_DELAY_MS = 15 * 1000;

let settings;
let onUpdateAvailable;
let checkTimer = null;
let availableUpdate = null;

export function initUpdateChecker(store, onAvailable) {
  settings = store;
  onUpdateAvailable = onAvailable;
}

export function startUpdateChecks() {
  if (checkTimer) return;
  const tick = async () => {
    await checkForUpdates();
    checkTimer = setTimeout(tick, CHECK_INTERVAL_MS);
  };
  checkTimer = setTimeout(tick, FIRST_CHECK_DELAY_MS);
}

export function stopUpdateChecks() {
  clearTimeout(checkTimer);
  checkTimer = null;
}

async function checkForUpdates() {
  try {
    const response = await fetch(LATEST_RELEASE_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return;
    const release = await response.json();
    if (release.draft || release.prerelease) return;
    const version = String(release.tag_name ?? "").replace(/^v/, "");
    if (!version || !isNewerVersion(version, app.getVersion())) return;
    if (availableUpdate?.version === version) return;
    availableUpdate = { version, url: release.html_url };
    onUpdateAvailable?.(availableUpdate);
    notifyOncePerVersion(availableUpdate);
  } catch {
    // Network errors, rate limits, malformed responses: stay quiet and let
    // the next scheduled check try again.
  }
}

export function isNewerVersion(latest, current) {
  const a = latest.split(".").map(Number);
  const b = current.split(".").map(Number);
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

// The system notification fires once per release; the tray menu item added by
// main.js keeps the download reachable after the notification is dismissed.
function notifyOncePerVersion(update) {
  if (settings.get("lastNotifiedUpdateVersion") === update.version) return;
  settings.set("lastNotifiedUpdateVersion", update.version);
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: "Copybara update available",
    body: `Version ${update.version} is ready to download.`,
  });
  notification.on("click", () => shell.openExternal(update.url));
  notification.show();
}
