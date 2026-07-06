const crypto = require("crypto");
const { clipboard, ipcRenderer } = require("electron");

const ClipTypes = { text: "text", image: "image", html: "html" };
let clipboardHistory = [];

function clipboardListener() {
  // const hasFiles = clipboard.has("NSFilenamesPboardType");
  // if (hasFiles) {
  //   console.log("has file");
  //   console.log("file: ", clipboard.read("NSFilenamesPboardType"));
  // }

  console.log("availableFormats", clipboard.availableFormats());

  const rft = clipboard.readRTF();
  console.log("rft: ", rft);
  const html = clipboard.readHTML();
  console.log("html: ", html);

  const start = Date.now();
  let currentClip = getCurrentClip();
  const fromClip = clipboard.readText();
  console.log("text:", fromClip);
  console.log("clipboard.has(text/html):", clipboard.has("text/html"));
  if (html && clipboard.availableFormats().includes("text/html")) {
    if (
      html &&
      (!currentClip ||
        currentClip.type !== ClipTypes.html ||
        currentClip.raw !== html)
    ) {
      addClipboardHistory({
        value: fromClip.trim() === "" ? "  " : fromClip.substring(0, 256),
        raw: html,
        rawStr: fromClip,
        type: ClipTypes.html,
      });
    }
  } else if (fromClip) {
    if (
      fromClip &&
      (!currentClip ||
        currentClip.type !== ClipTypes.text ||
        currentClip.raw !== fromClip)
    ) {
      addClipboardHistory({
        value: fromClip.trim() === "" ? "  " : fromClip.substring(0, 256),
        raw: fromClip,
        type: ClipTypes.text,
      });
    }
  } else {
    const img = clipboard.readImage();
    let bitmap = img.getBitmap();
    const isNewValue =
      bitmap.length > 0 &&
      (!currentClip ||
        currentClip.type !== ClipTypes.image ||
        !currentClip.raw.getBitmap().equals(bitmap));
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
  const end = Date.now();
  //   console.log(`Execution time: ${end - start} ms`);
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
  ipcRenderer.send("new-clip", clip);
}

function removeClip(uuid) {
  console.log("removeClip: ", uuid);
  let currentClip = getCurrentClip();
  const isCurrentRemoved = uuid === currentClip.uuid;
  clipboardHistory = clipboardHistory.filter((item) => item.uuid !== uuid);
  if (isCurrentRemoved) {
    currentClip = getCurrentClip();
    if (currentClip) {
      if (currentClip.type === ClipTypes.text) {
        clipboard.writeText(currentClip.raw);
      }
      if (currentClip.type === ClipTypes.image) {
        clipboard.writeImage(currentClip.raw);
      }
      if (currentClip.type === ClipTypes.html) {
        clipboard.write({
          text: currentClip.rawStr,
          html: currentClip.raw.replace("<meta charset='utf-8'>", ""),
        });
      }
    } else {
      clipboard.writeText("");
    }
  }
}

function pinClip(uuid, pin) {
  const index = getIndexOfElementByUuid(uuid);

  if (index !== -1) {
    clipboardHistory[index].pinned = pin;
  }
}

function selectClip(uuid, forceUpdate) {
  const index = getIndexOfElementByUuid(uuid);
  if (index !== -1) {
    const clip = clipboardHistory.splice(index, 1)[0];
    if (clip.type === ClipTypes.text) {
      clipboard.writeText(clip.raw);
    }
    if (clip.type === ClipTypes.image) {
      clipboard.writeImage(clip.raw);
    }
    if (clip.type === ClipTypes.html) {
      clipboard.write({
        text: clip.rawStr,
        html: clip.raw.replace("<meta charset='utf-8'>", ""),
      });
    }
    addClipboardHistory(clip);
    if (forceUpdate) {
      ipcRenderer.send("clipboard-history", clipboardHistory);
    }
  }
}

function getCurrentClip() {
  return clipboardHistory[clipboardHistory.length - 1];
}

function getClipInfo(uuid) {
  const index = getIndexOfElementByUuid(uuid);
  if (index !== -1) {
    const clip = clipboardHistory[index];
    if (clip.type === "image") {
      clip.value = clip.raw.toDataURL();
    }
    ipcRenderer.send("show-clip-info", clip);
  }
}

const getIndexOfElementByUuid = (uuid) => {
  return clipboardHistory.findIndex((clip) => {
    return clip.uuid === uuid;
  });
};

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

window.onbeforeunload = (e) => {
  ipcRenderer.send("clipboard-history", clipboardHistory);
};

ipcRenderer.on("start-clipboard-listener", () => clipboardListener());
ipcRenderer.on(
  "set-clipboard-history",
  (event, history) => (clipboardHistory = history)
);

ipcRenderer.on("remove-clip", (event, uuid) => removeClip(uuid));
ipcRenderer.on("pin-clip", (event, uuid, pin) => pinClip(uuid, pin));
ipcRenderer.on("select-clip", (event, uuid, forceUpdate = false) =>
  selectClip(uuid, forceUpdate)
);
ipcRenderer.on("get-clip-info", (event, uuid) => getClipInfo(uuid));
