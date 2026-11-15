// Pinned version: update it when you want a newer release.
import { removeBackground } from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm";

const $ = (id) => document.getElementById(id);
const drop = $("drop"), fileInput = $("file"), status = $("status"),
      statusText = $("statusText"), barFill = $("barFill"), work = $("work"),
      before = $("before"), afterBox = $("afterBox"), canvas = $("canvas"),
      stage = $("stage"), slider = $("slider");
const ctx = canvas.getContext("2d");

let srcUrl = null, bg = "transparent", bgImg = null, bgUrl = null;
let W = 0, H = 0;

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = url;
});

/* ---------- Upload and background removal ---------- */
drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handle(fileInput.files[0]);
});
["dragenter", "dragover"].forEach(type => drop.addEventListener(type, (e) => {
  e.preventDefault();
  drop.classList.add("over");
}));
["dragleave", "drop"].forEach(type => drop.addEventListener(type, (e) => {
  e.preventDefault();
  drop.classList.remove("over");
}));
drop.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handle(file);
});

async function handle(file) {
  if (!file.type.startsWith("image/")) {
    showError("That file is not an image. Choose a JPG, PNG or WebP.");
    return;
  }

  if (srcUrl) URL.revokeObjectURL(srcUrl);
  srcUrl = URL.createObjectURL(file);
  drop.hidden = true;
  work.hidden = true;
  status.hidden = false;
  statusText.textContent = "Loading the model…";
  barFill.style.width = "0";

  try {
    const blob = await removeBackground(file, {
      progress: (key, current, total) => {
        const pct = total ? Math.round((current / total) * 100) : 0;
        statusText.textContent = key.startsWith("fetch")
          ? `Downloading model… ${pct}%`
          : "Removing the background…";
        barFill.style.width = pct + "%";
      },
      output: { format: "image/png" }
    });

    const resultUrl = URL.createObjectURL(blob);
    const [original, cutout] = await Promise.all([
      loadImage(srcUrl),
      loadImage(resultUrl)
    ]);
    setup(original, cutout);
    URL.revokeObjectURL(resultUrl);

    status.hidden = true;
    work.hidden = false;
    slider.value = 50;
    setPos(50);
    setBg("transparent");
  } catch (error) {
    console.error(error);
    showError("The background could not be removed. Check your connection, then try again. Open this page from a local server, not a file:// address.");
  }
}

function showError(message) {
  status.hidden = false;
  work.hidden = true;
  drop.hidden = false;
  statusText.textContent = message;
  barFill.style.width = "0";
}

function setup(original, cutout) {
  W = cutout.naturalWidth;
  H = cutout.naturalHeight;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(cutout, 0, 0, W, H);
  before.src = srcUrl;
  stage.style.aspectRatio = `${W} / ${H}`;
  stage.style.maxWidth = `min(100%, ${(70 * W / H).toFixed(2)}vh)`;
}

/* ---------- Before/after comparison ---------- */
function setPos(value) {
  stage.style.setProperty("--pos", value + "%");
}
slider.addEventListener("input", () => setPos(slider.value));

/* ---------- Background: transparent, color or image ---------- */
function setBg(value) {
  bg = value;
  afterBox.classList.toggle("checker", value === "transparent");
  afterBox.style.background = "";

  if (value === "image" && bgUrl) {
    afterBox.style.backgroundImage = `url(${bgUrl})`;
    afterBox.style.backgroundSize = "cover";
    afterBox.style.backgroundPosition = "center";
  } else if (value !== "transparent") {
    afterBox.style.background = value;
    afterBox.style.backgroundImage = "none";
  } else {
    afterBox.style.backgroundImage = "none";
  }

  document.querySelectorAll("#swatches .sw[data-bg]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.bg === value));
  });
  $("bgImgBtn").setAttribute("aria-pressed", String(value === "image"));
}

document.querySelectorAll("#swatches .sw[data-bg]").forEach(button => {
  button.addEventListener("click", () => setBg(button.dataset.bg));
});
$("custom").addEventListener("input", (e) => setBg(e.target.value));

$("bgImgBtn").addEventListener("click", () => $("bgFile").click());
$("bgFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !file.type.startsWith("image/")) return;

  try {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    bgUrl = url;
    bgImg = img;
    $("bgImgBtn").style.backgroundImage = `url(${url})`;
    $("bgImgBtn").classList.add("has-img");
    setBg("image");
  } catch (error) {
    console.error(error);
  }
});

/* ---------- Reset and download ---------- */
$("again").addEventListener("click", () => {
  work.hidden = true;
  status.hidden = true;
  drop.hidden = false;
  fileInput.value = "";
  setPos(50);
});

$("download").addEventListener("click", () => {
  const output = document.createElement("canvas");
  output.width = W;
  output.height = H;
  const outputCtx = output.getContext("2d");

  if (bg === "image" && bgImg) {
    const scale = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
    const width = bgImg.naturalWidth * scale;
    const height = bgImg.naturalHeight * scale;
    outputCtx.drawImage(bgImg, (W - width) / 2, (H - height) / 2, width, height);
  } else if (bg !== "transparent") {
    outputCtx.fillStyle = bg;
    outputCtx.fillRect(0, 0, W, H);
  }

  outputCtx.drawImage(canvas, 0, 0);
  output.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cutout.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
});
