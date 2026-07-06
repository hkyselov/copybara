console.log(
  '👋 This message is being logged by "clip-info.js", included via Vite'
);

function loading() {
  console.log("loading...");
  const loaderWrapper = document.querySelector(".loaderWrapper");
  const infoWrapper = document.querySelector(".infoWrapper");
  loaderWrapper.style.display = "grid";
  infoWrapper.style.display = "none";
}

function loaded() {
  const loaderWrapper = document.querySelector(".loaderWrapper");
  const infoWrapper = document.querySelector(".infoWrapper");
  loaderWrapper.style.display = "none";
  infoWrapper.style.display = "flex";
}

loading();

window.electronAPI.onUpdateClipInfo((clip) => {
  console.log("clip: ", clip);

  const textArea = document.getElementById("textValue");
  const img = document.getElementById("imgValue");
  const imgWrapper = document.querySelector(".imgWrapper");
  if (clip.type === "text" || clip.type === "html") {
    imgWrapper.style.display = "none";
    textArea.textContent = clip.type === "html" ? clip.rawStr : clip.raw;
    textArea.style.display = "block";
  } else {
    const start = Date.now();
    textArea.style.display = "none";
    img.src = clip.value;
    imgWrapper.style.display = "grid";
    const end = Date.now();
    console.log(`Execution time: ${end - start} ms`);
  }
  const clipTime = document.getElementById("clipTime");
  clipTime.textContent = clip.time.toLocaleString();

  loaded();
});
