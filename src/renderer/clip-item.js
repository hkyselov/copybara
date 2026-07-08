class ClipItem extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    const template = document.getElementById("clip-item-template");
    const templateContent = template.content;
    this.shadowRoot.append(templateContent.cloneNode(true));
    this.removeItem = this.removeItem.bind(this);
    this.pinClip = this.pinClip.bind(this);
    this.clipInfo = this.clipInfo.bind(this);
    this.selectClip = this.selectClip.bind(this);
    this.stopPropogation = this.stopPropogation.bind(this);
    this.keyDown = this.keyDown.bind(this);
    this.keyPressed = this.keyPressed.bind(this);
  }

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ["pinned"];
  }

  disconnectedCallback() {
    this.removeEventListener("pointerdown", this.pointerDown);
    this.removeEventListener("click", this.selectClip);

    this.removeEventListener("keypress", this.enterPressed);
    this.removeEventListener("keydown", this.keyDown);

    const closeBtn = this.shadowRoot.querySelector(".btnRed");
    closeBtn.removeEventListener("click", this.removeItem);

    const pinBtn = this.shadowRoot.querySelector("input[type=checkbox]");
    pinBtn.removeEventListener("change", this.pinClip);
    pinBtn.removeEventListener("click", this.stopPropogation);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "pinned" && oldValue && oldValue !== newValue) {
      this.renderPin(newValue.toLowerCase() === "true");
    }
  }

  render() {
    this.renderClipContent();
    this.addListeners();
    this.renderPin(this.pinned === "true");
    setTimeout(() => {
      this.focus({ focusVisible: true });
    }, 0);
  }

  renderPin(pin) {
    const checkbox = this.shadowRoot.querySelector("input[type=checkbox]");
    checkbox.checked = pin;
    if (pin) {
      this.shadowRoot.querySelector(".pinIcon").classList.add("show");
    } else {
      this.shadowRoot.querySelector(".pinIcon").classList.remove("show");
    }
  }

  renderClipContent() {
    const clipBtn = this.shadowRoot.querySelector("li a");
    if (this.type === "text" || this.type === "html") {
      const span = document.createElement("span");
      span.innerText = this.textContent;
      clipBtn.prepend(span);
    } else if (this.type === "image") {
      const img = document.createElement("img");
      img.src = this.textContent;
      clipBtn.prepend(img);
    }
  }

  addListeners() {
    this.addEventListener("pointerdown", this.pointerDown);
    this.addEventListener("click", this.selectClip);

    this.addEventListener("keypress", this.keyPressed);
    this.addEventListener("keydown", this.keyDown);

    const closeBtn = this.shadowRoot.querySelector(".btnRed");
    closeBtn.addEventListener("click", this.removeItem);

    const infoBtn = this.shadowRoot.querySelector(".btnInfo");
    infoBtn.addEventListener("click", this.clipInfo);

    const pinBtn = this.shadowRoot.querySelector("input[type=checkbox]");
    pinBtn.addEventListener("change", this.pinClip);
    pinBtn.addEventListener("click", this.stopPropogation);
  }

  pinClip(event) {
    event.stopPropagation();
    event.preventDefault();
    this.pinned = event.target.checked;
    window.electronAPI.pinClip(this.uuid, this.pinned);
  }

  clipInfo(event) {
    event.stopPropagation();
    event.preventDefault();
    window.electronAPI.clipInfo(this.uuid);
  }

  removeItem(event) {
    event?.stopPropagation();
    event?.preventDefault();
    this.classList.remove("show");
    this.ontransitionend = (event) => {
      if (event.propertyName === "scale") {
        this.remove();
        document.querySelector("ul").firstElementChild?.focus();
        window.electronAPI.removeClip(this.uuid);
      }
    };
  }

  selectClip(event) {
    this.focus();
    event.stopPropagation();
    event.preventDefault();
    if (this == this.parentNode.firstElementChild) {
      // Topmost clip keeps its position, so skip the remove-animation but
      // still notify main so the window hides and the clip gets pasted.
      window.electronAPI.selectClip(this.uuid);
      return;
    }
    this.classList.remove("show");
    this.ontransitionend = (event) => {
      if (event.propertyName === "scale") {
        this.remove();
        window.electronAPI.selectClip(this.uuid);
      }
    };
  }

  stopPropogation(event) {
    event.stopPropagation();
  }

  keyPressed(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this.click();
    }

    if (event.key.toLowerCase() === "p") {
      this.pinned = this.pinned !== "true";
      this.shadowRoot.querySelector("input[type=checkbox]").checked =
        this.pinned === "true";
      window.electronAPI.pinClip(this.uuid, this.pinned);
    }

    if (event.key.toLowerCase() === "i") {
      window.electronAPI.clipInfo(this.uuid);
    }
  }

  keyDown(event) {
    if (event.key == "Backspace") {
      this.removeItem(event);
    }
  }

  pointerDown(event) {
    event.preventDefault();
  }

  get uuid() {
    return this.getAttribute("uuid");
  }

  set uuid(uuid) {
    this.setAttribute("uuid", uuid);
  }

  get type() {
    return this.getAttribute("type");
  }

  set type(type) {
    this.setAttribute("type", type);
  }

  get pinned() {
    return this.getAttribute("pinned");
  }

  set pinned(pinned) {
    this.setAttribute("pinned", pinned);
  }

  get time() {
    return this.getAttribute("time");
  }

  set time(time) {
    this.setAttribute("time", time);
  }
}

customElements.define("clip-item", ClipItem);
