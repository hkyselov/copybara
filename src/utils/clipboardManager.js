import { clipboard } from "electron";
import crypto from "node:crypto";

const ClipTypes = { text: "text", image: "image", html: "html" };

let clipboardHistory = [];
let callbacks = {
  onNewClip: () => {},
  onHistoryChange: () => {},
  onShowClipInfo: () => {},
};

export function initClipboardManager({
  onNewClip,
  onHistoryChange,
  onShowClipInfo,
}) {
  callbacks = { onNewClip, onHistoryChange, onShowClipInfo };
}

export function startClipboardListener() {
  clipboardListener();
}

function clipboardListener() {
  let currentClip = getCurrentClip();
  const fromClip = clipboard.readText();
  const html = normalizeHtml(clipboard.readHTML());
  if (html && clipboard.availableFormats().includes("text/html")) {
    if (
      !currentClip ||
      currentClip.type !== ClipTypes.html ||
      currentClip.raw !== html
    ) {
      addClipboardHistory({
        // display value only — trimmed so pre-wrap rendering doesn't show
        // leading/trailing blank lines; raw/rawStr keep the exact clipboard
        value: fromClip.trim() === "" ? "  " : fromClip.trim().substring(0, 256),
        raw: html,
        rawStr: fromClip,
        type: ClipTypes.html,
      });
    }
  } else if (fromClip) {
    if (
      !currentClip ||
      currentClip.type !== ClipTypes.text ||
      currentClip.raw !== fromClip
    ) {
      addClipboardHistory({
        value: fromClip.trim() === "" ? "  " : fromClip.trim().substring(0, 256),
        raw: fromClip,
        type: ClipTypes.text,
      });
    }
  } else {
    const img = clipboard.readImage();
    let bitmap = img.toBitmap();
    const isNewValue =
      bitmap.length > 0 &&
      (!currentClip ||
        currentClip.type !== ClipTypes.image ||
        !currentClip.raw.toBitmap().equals(bitmap));
    bitmap = null;
    if (isNewValue) {
      const resizedImg = resizeImg(img).toDataURL();
      addClipboardHistory({
        value: resizedImg,
        raw: img,
        type: ClipTypes.image,
      });
    }
  }
  setTimeout(clipboardListener, 300);
}

function addClipboardHistory({
  value,
  raw,
  type,
  uuid = crypto.randomUUID(),
  time = new Date(),
  pinned = false,
  rawStr,
}) {
  const clip = {
    uuid,
    value,
    raw,
    time,
    type,
    pinned,
    rawStr,
  };
  clipboardHistory.push(clip);
  callbacks.onNewClip(stripRaw(clip));
}

export function removeClip(uuid) {
  let currentClip = getCurrentClip();
  const isCurrentRemoved = uuid === currentClip.uuid;
  clipboardHistory = clipboardHistory.filter((item) => item.uuid !== uuid);
  if (isCurrentRemoved) {
    currentClip = getCurrentClip();
    if (currentClip) {
      writeClipToClipboard(currentClip);
    } else {
      clipboard.writeText("");
    }
  }
}

export function pinClip(uuid, pin) {
  const index = getIndexOfElementByUuid(uuid);

  if (index !== -1) {
    clipboardHistory[index].pinned = pin;
  }
}

export function selectClip(uuid, forceUpdate) {
  const index = getIndexOfElementByUuid(uuid);
  if (index === -1) return;
  if (index === clipboardHistory.length - 1) {
    // Topmost clip: order unchanged; just refresh the OS clipboard.
    // Skipping addClipboardHistory avoids a duplicate onNewClip render.
    writeClipToClipboard(clipboardHistory[index]);
    return;
  }
  const clip = clipboardHistory.splice(index, 1)[0];
  writeClipToClipboard(clip);
  addClipboardHistory(clip);
  if (forceUpdate) {
    callbacks.onHistoryChange(getClipboardHistory());
  }
}

export function getClipInfo(uuid) {
  const index = getIndexOfElementByUuid(uuid);
  if (index !== -1) {
    const clip = clipboardHistory[index];
    if (clip.type === ClipTypes.image) {
      // the clip-info window renders images from `value`; text/html need `raw`/`rawStr`
      callbacks.onShowClipInfo({
        ...stripRaw(clip),
        value: clip.raw.toDataURL(),
      });
    } else {
      callbacks.onShowClipInfo(clip);
    }
  }
}

export function getClipboardHistory() {
  return clipboardHistory.map(stripRaw);
}

function writeClipToClipboard(clip) {
  if (clip.type === ClipTypes.text) {
    clipboard.writeText(clip.raw);
  }
  if (clip.type === ClipTypes.image) {
    clipboard.writeImage(clip.raw);
  }
  if (clip.type === ClipTypes.html) {
    clipboard.write({
      text: clip.rawStr,
      html: normalizeHtml(clip.raw),
    });
  }
}

// Chromium prepends this meta tag to any HTML it writes to the clipboard,
// so strip it on read to keep raw stable across write-back round-trips.
const normalizeHtml = (html) => html.replace(/^<meta charset=['"]utf-8['"]>/i, "");

function getCurrentClip() {
  return clipboardHistory[clipboardHistory.length - 1];
}

const getIndexOfElementByUuid = (uuid) => {
  return clipboardHistory.findIndex((clip) => {
    return clip.uuid === uuid;
  });
};

const stripRaw = ({ raw, ...rest }) => rest;

const resizeImg = function (img) {
  const maxSize = 256;
  const { width, height } = img.getSize();
  if (width > maxSize || height > maxSize) {
    if (width > height) {
      return img.resize({ width: maxSize });
    } else {
      return img.resize({ height: maxSize });
    }
  }

  return img;
};
