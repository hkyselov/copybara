import { keys } from "./keys.js";

console.log(
  '👋 This message is being logged by "settings.js", included via Vite'
);

window.electronAPI.onLoadSettings((settings) => {
  const openAtLoginCheckbox = document.querySelector(
    'input[value="openAtLogin"]'
  );
  openAtLoginCheckbox.checked = settings.openAtLogin;

  openAtLoginCheckbox.onchange = (event) => {
    window.electronAPI.saveSettings(
      openAtLoginCheckbox.value,
      openAtLoginCheckbox.checked
    );
  };

  const autoHideWindowCheckbox = document.querySelector(
    'input[value="autoHideWindow"]'
  );
  autoHideWindowCheckbox.checked = settings.autoHideWindow;
  autoHideWindowCheckbox.onchange = (event) => {
    window.electronAPI.saveSettings(
      autoHideWindowCheckbox.value,
      autoHideWindowCheckbox.checked
    );
  };

  const autoHideDelaySelect = document.getElementById("autohide-delay");
  autoHideDelaySelect.value = settings.autoHideDelayTime;
  autoHideDelaySelect.onchange = (event) => {
    window.electronAPI.saveSettings(
      "autoHideDelayTime",
      autoHideDelaySelect.value
    );
  };

  const shortcuInput = document.getElementById("shortcut");
  shortcuInput.value = settings.openClipboardShortcut.display;

  displayShortcut();
});

function openTab(event, tabName) {
  let general = document.getElementById("general");
  let about = document.getElementById("about");
  general.style.display = "none";
  about.style.display = "none";
  document.getElementById("general-btn").classList.remove("active-btn");
  document.getElementById("about-btn").classList.remove("active-btn");
  document.getElementById(tabName).style.display =
    tabName === "general " ? "flex" : "grid";
  event.currentTarget.classList.add("active-btn");
}

function displayShortcut() {
  const input = document.getElementById("shortcut");
  const deleteShortcut = document.querySelector(".deleteShortcut");

  if (input.value === "") {
    input.disabled = false;
    deleteShortcut.style.display = "none";
  } else {
    input.disabled = true;
    deleteShortcut.style.display = "inline-block";
  }
}

displayShortcut();

document.getElementById("general-btn").addEventListener("click", (e) => {
  openTab(e, "general");
});

document.getElementById("about-btn").addEventListener("click", (e) => {
  openTab(e, "about");
});

document.getElementById("shortcut").addEventListener(
  "keydown",
  (e) => {
    e.preventDefault();
    console.log(e);
    const key = e.key;
    const charCode = e.code;

    // if ((keyCode >= 16 && keyCode <= 18) || keyCode === 91) return;

    const display = [];
    const accelerator = [];
    if (e.ctrlKey) {
      display.push("⌃");
      accelerator.push("Control");
    }
    if (e.shiftKey) {
      display.push("⇧");
      accelerator.push("Shift");
    }
    if (e.altKey) {
      display.push("⌥");
      accelerator.push("Alt");
    }
    if (e.metaKey) {
      display.push("⌘");
      accelerator.push("Command");
    }
    const isModifierPressed = e.ctrlKey || e.shiftKey || e.altKey || e.metaKey;
    const isOnlyMidifierPressed =
      key !== "Meta" && key !== "Shift" && key !== "Control" && key !== "Alt";
    if (isOnlyMidifierPressed && isModifierPressed) {
      display.push(keys[charCode].display);
      accelerator.push(keys[charCode].accelerator);
      displayShortcut();
      window.electronAPI.saveSettings("openClipboardShortcut", {
        display: display.join(""),
        accelerator: accelerator.join("+"),
      });
    }

    document.getElementById("shortcut").value = display.join("");
  },
  true
);

document.querySelector(".deleteShortcut").addEventListener("click", (e) => {
  const input = document.getElementById("shortcut");
  input.value = "";
  window.electronAPI.saveSettings("openClipboardShortcut", null);
  displayShortcut();
  setTimeout(() => {
    input.focus();
  }, 0);
});

document.querySelector(".restore").addEventListener("click", (e) => {
  window.electronAPI.saveSettings("restoreToDefault", null);
});
