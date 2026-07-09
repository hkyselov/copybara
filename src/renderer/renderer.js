/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

console.log(
  '👋 This message is being logged by "renderer.js", included via Vite'
);

import "./clip-item.js";

let autoHideInterval;

window.electronAPI.onUpdateClipboard((clip) => {
  const ul = document.getElementById("list");
  if (Array.isArray(clip)) {
    const clipsToRemove = document.querySelectorAll("clip-item");
    clipsToRemove.forEach((item) => item.remove());
    clip.forEach((item) => createItem(item, ul));
  } else {
    createItem(clip, ul);
  }
});

window.electronAPI.onUpdateWindowPin((pin) => {
  const pinCheckbox = document.getElementById("windowPin");
  pinCheckbox.checked = pin;
});

window.electronAPI.onNextClip(() => {
  next();
});

window.electronAPI.onUpdateClipDisplayLines((lines) => {
  document.documentElement.style.setProperty("--clip-lines", lines);
});

function createItem(item, ul) {
  const clipItem = document.createElement("clip-item");
  clipItem.uuid = item.uuid;
  clipItem.type = item.type;
  clipItem.time = item.time;
  clipItem.pinned = item.pinned;
  clipItem.setAttribute("tabIndex", 0);

  // textContent keeps newlines as real \n (innerText would turn them into
  // <br> elements, which get lost when clip-item reads textContent back)
  clipItem.textContent = item.value;
  ul.prepend(clipItem);
  setTimeout(function () {
    clipItem.classList.add("show");
  }, 15);
}

function setupListeners() {
  document.addEventListener("pointerdown", (e) => {
    e.preventDefault();
  });

  document.body.onfocus = (e) => {
    setTimeout(() => {
      const ul = document.querySelector("ul");
      ul.firstElementChild?.focus();
    }, 0);
  };

  document.addEventListener("keydown", (e) => {
    if (e.key == "ArrowDown") {
      next();
    }
    if (e.key == "ArrowUp") {
      prev();
    }
    if (e.key == "Escape") {
      window.electronAPI.hideWindow();
    }
  });

  document.addEventListener("mouseenter", (e) => {
    autoHideInterval = setInterval(() => {
      preventAutoHide();
    }, 400);
  });

  document.addEventListener("mouseleave", (e) => {
    if (autoHideInterval) clearInterval(autoHideInterval);
  });

  document.getElementById("windowPin").addEventListener("change", (e) => {
    window.electronAPI.pinWindow(e.target.checked);
  });

  document.querySelector(".clearBtn").addEventListener("click", (e) => {
    const clipElements = document.querySelectorAll("clip-item");
    Array.from(clipElements)
      .filter((clip) => clip.pinned === "false")
      .forEach((clip) => {
        clip.removeItem();
      });
  });
}

function next() {
  const clip = document.querySelector("clip-item:focus");
  const ul = document.querySelector("ul");

  let next = clip?.nextElementSibling;
  if (!next || next.tagName.toLowerCase() !== "clip-item") {
    next = document.querySelector("clip-item:first-of-type");
  }
  preventAutoHide();
  setTimeout(() => {
    next?.focus();
  }, 0);
}

function prev() {
  const clip = document.querySelector("clip-item:focus");
  const ul = document.querySelector("ul");
  let prev = clip?.previousElementSibling;
  if (!prev || prev.tagName.toLowerCase() !== "clip-item") {
    prev = document.querySelector("clip-item:last-of-type");
  }
  preventAutoHide();
  setTimeout(() => {
    prev?.focus();
  }, 0);
}

function preventAutoHide() {
  window.electronAPI.preventAutoHide();
}

setupListeners();
