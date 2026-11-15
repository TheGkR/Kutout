// Pinned version: update it when you want a newer release.
import { removeBackground } from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm";

const $ = (id) => document.getElementById(id);
const drop = $("drop"), fileInput = $("file"), status = $("status"), statusText = $("statusText"),
      barFill = $("barFill"), work = $("work"), before = $("before"), after = $("after"),
      afterBox = $("afterBox"), stage = $("stage"), slider = $("slider");

let srcUrl = null, cutUrl = null;
let bg = "transparent", bgImg = null, bgUrl = null;

const loadImage = (url) => new Promise((res, rej) => {
  const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
});

/* ---------- Upload and background removal ---------- */
drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener("change", () => fileInput.files[0] && handle(fileInput.files[0]));
["dragenter", "dragover"].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) handle(f); });

async function handle(file) {
  if (!file.type.startsWith("image/")) { showError("That file is not an image. Choose a JPG, PNG or WebP."); return; }
  if (srcUrl) URL.revokeObjectURL(srcUrl);
  if (cutUrl) URL.revokeObjectURL(cutUrl);
  srcUrl = URL.createObjectURL(file);
  drop.hidden = true; work.hidden = true; status.hidden = false;
  statusText.textContent = "Loading the model…"; barFill.style.width = "0";

  try {
    const blob = await removeBackground(file, {
      progress: (key, current, total) => {
        const pct = total ? Math.round((current / total) * 100) : 0;
        statusText.textContent = key.startsWith("fetch") ? `Downloading model… ${pct}%` : "Removing the background…";
        barFill.style.width = pct + "%";
      },
      output: { format: "image/png" }
    });
    cutUrl = URL.createObjectURL(blob);
    before.src = srcUrl; after.src = cutUrl;
    await Promise.all([before.decode(), after.decode()]);
    status.hidden = true; work.hidden = false;
    slider.value = 50; setPos(50); setBg("transparent");
  } catch (err) {
    console.error(err);
    showError("The background could not be removed. Check your connection, then try again. Open this page from a local server, not a file:// address.");
  }
}

function showError(msg) {
  status.hidden = false; work.hidden = true; drop.hidden = false;
  statusText.textContent = msg; barFill.style.width = "0";
}

/* ---------- Comparison slider ---------- */
function setPos(v) { stage.style.setProperty("--pos", v + "%"); }
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
  }
  document.querySelectorAll("#swatches .sw[data-bg]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.bg === value)));
  $("bgImgBtn").setAttribute("aria-pressed", String(value === "image"));
}
document.querySelectorAll("#swatches .sw[data-bg]").forEach(b => b.addEventListener("click", () => setBg(b.dataset.bg)));
$("custom").addEventListener("input", (e) => setBg(e.target.value));

$("bgImgBtn").addEventListener("click", () => $("bgFile").click());
$("bgFile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f || !f.type.startsWith("image/")) return;
  try {
    const url = URL.createObjectURL(f);
    const img = await loadImage(url);
    if (bgUrl) URL.revokeObjectURL(bgUrl);
    bgUrl = url; bgImg = img;
    $("bgImgBtn").style.backgroundImage = `url(${url})`;
    $("bgImgBtn").classList.add("has-img");
    setBg("image");
  } catch (err) { console.error(err); }
});

/* ---------- Reset and download ---------- */
$("again").addEventListener("click", () => {
  work.hidden = true; status.hidden = true; drop.hidden = false; fileInput.value = "";
});

$("download").addEventListener("click", () => {
  const W = after.naturalWidth, H = after.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (bg === "image" && bgImg) {
    const s = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight); // same as CSS "cover"
    const w = bgImg.naturalWidth * s, h = bgImg.naturalHeight * s;
    ctx.drawImage(bgImg, (W - w) / 2, (H - h) / 2, w, h);
  } else if (bg !== "transparent") {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  }
  ctx.drawImage(after, 0, 0);
  c.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "cutout.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
});
