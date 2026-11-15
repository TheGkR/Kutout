// Pinned version: update it when you want a newer release.
import { removeBackground } from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm";

const $ = (id) => document.getElementById(id);
const drop = $("drop"), fileInput = $("file"), status = $("status"), statusText = $("statusText"),
      barFill = $("barFill"), work = $("work"), before = $("before"), ghost = $("ghost"),
      afterBox = $("afterBox"), canvas = $("canvas"), stage = $("stage"), slider = $("slider"),
      ring = $("ring"), tools = $("tools"), undoBtn = $("undo");
const sctx = canvas.getContext("2d");

// Editing model: the visible canvas = original pixels, masked by the alpha of `maskC`.
// Erase removes alpha from the mask, Restore paints it back, so restored areas show the original photo.
const makeCanvas = (opts) => document.createElement("canvas");
const maskC = makeCanvas(), mctx = maskC.getContext("2d");
const origC = makeCanvas(), octx = origC.getContext("2d");
const snapC = makeCanvas(), snctx = snapC.getContext("2d", { willReadFrequently: true });

let srcUrl = null, cutUrl = null, cutImg = null, W = 0, H = 0;
let bg = "transparent", bgImg = null, bgUrl = null;
let mode = "compare", tool = "erase", brushSize = 40, softness = 0.5;
let undoStack = [], stroke = null;

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
    const [orig, cut] = await Promise.all([loadImage(srcUrl), loadImage(cutUrl)]);
    setup(orig, cut);
    status.hidden = true; work.hidden = false;
    slider.value = 50; setMode("compare"); setBg("transparent");
  } catch (err) {
    console.error(err);
    showError("The background could not be removed. Check your connection, then try again. Open this page from a local server, not a file:// address.");
  }
}

function showError(msg) {
  status.hidden = false; work.hidden = true; drop.hidden = false;
  statusText.textContent = msg; barFill.style.width = "0";
}

function setup(orig, cut) {
  cutImg = cut; W = cut.naturalWidth; H = cut.naturalHeight;
  for (const c of [canvas, maskC, origC, snapC]) { c.width = W; c.height = H; }
  octx.drawImage(orig, 0, 0, W, H);
  before.src = srcUrl; ghost.src = srcUrl;
  stage.style.aspectRatio = `${W} / ${H}`;
  stage.style.maxWidth = `min(100%, ${(70 * W / H).toFixed(2)}vh)`;
  resetMask();
}

/* ---------- Canvas compositing ---------- */
// Redraw one rectangle of the visible canvas from the original image and the mask.
function refresh(x, y, w, h) {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
  const rw = x1 - x0, rh = y1 - y0;
  if (rw <= 0 || rh <= 0) return null;
  sctx.save();
  sctx.globalCompositeOperation = "source-over";
  sctx.clearRect(x0, y0, rw, rh);
  sctx.drawImage(origC, x0, y0, rw, rh, x0, y0, rw, rh);
  sctx.globalCompositeOperation = "destination-in";
  sctx.drawImage(maskC, x0, y0, rw, rh, x0, y0, rw, rh);
  sctx.restore();
  return [x0, y0, x1, y1];
}

function resetMask() {
  mctx.globalCompositeOperation = "source-over";
  mctx.clearRect(0, 0, W, H);
  mctx.drawImage(cutImg, 0, 0, W, H);
  refresh(0, 0, W, H);
  undoStack = []; updateUndo();
}

/* ---------- Mode and tools ---------- */
function setPos(v) { stage.style.setProperty("--pos", v + "%"); }
slider.addEventListener("input", () => setPos(slider.value));

function setMode(m) {
  mode = m;
  const edit = m === "edit";
  stage.classList.toggle("editing", edit);
  tools.hidden = !edit;
  $("tabCompare").setAttribute("aria-selected", String(!edit));
  $("tabEdit").setAttribute("aria-selected", String(edit));
  setPos(edit ? 0 : slider.value);
  updateGhost();
  if (!edit) ring.hidden = true;
}
$("tabCompare").addEventListener("click", () => setMode("compare"));
$("tabEdit").addEventListener("click", () => setMode("edit"));

function setTool(t) {
  tool = t;
  document.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tool === t)));
  ring.className = "ring " + t;
}
document.querySelectorAll("[data-tool]").forEach(b => b.addEventListener("click", () => setTool(b.dataset.tool)));
setTool("erase");

function updateRing() { ring.style.width = ring.style.height = brushSize + "px"; }
$("size").addEventListener("input", (e) => { brushSize = +e.target.value; updateRing(); });
$("soft").addEventListener("input", (e) => { softness = e.target.value / 100; });
updateRing();

function updateGhost() { ghost.hidden = !(mode === "edit" && $("showOrig").checked); }
$("showOrig").addEventListener("change", updateGhost);

function updateUndo() { undoBtn.disabled = undoStack.length === 0; }

/* ---------- Brush ---------- */
function dab(x, y, r) {
  const hard = Math.min(0.99, 1 - softness);
  const g = mctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(hard, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  mctx.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over";
  mctx.fillStyle = g;
  mctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  const b = refresh(x - r, y - r, 2 * r, 2 * r);
  if (!b) return;
  const s = stroke.box;
  stroke.box = s ? [Math.min(s[0], b[0]), Math.min(s[1], b[1]), Math.max(s[2], b[2]), Math.max(s[3], b[3])] : b;
}

function paint(e) {
  const rect = stage.getBoundingClientRect(), k = W / rect.width;
  const x = (e.clientX - rect.left) * k, y = (e.clientY - rect.top) * k;
  const r = (brushSize / 2) * k, step = Math.max(1, r * 0.3), last = stroke.last;
  if (!last) dab(x, y, r);
  else {
    const n = Math.max(1, Math.floor(Math.hypot(x - last.x, y - last.y) / step));
    for (let i = 1; i <= n; i++) dab(last.x + ((x - last.x) * i) / n, last.y + ((y - last.y) * i) / n, r);
  }
  stroke.last = { x, y };
}

function moveRing(e) {
  const rect = stage.getBoundingClientRect();
  ring.style.left = e.clientX - rect.left + "px";
  ring.style.top = e.clientY - rect.top + "px";
  ring.hidden = false;
}

stage.addEventListener("pointerdown", (e) => {
  if (mode !== "edit" || e.button > 0) return;
  stage.setPointerCapture(e.pointerId);
  snctx.clearRect(0, 0, W, H); snctx.drawImage(maskC, 0, 0); // state before this stroke, for undo
  stroke = { box: null, last: null };
  moveRing(e); paint(e);
});
stage.addEventListener("pointermove", (e) => {
  if (mode !== "edit") return;
  moveRing(e);
  if (stroke) paint(e);
});
function endStroke() {
  if (!stroke) return;
  const b = stroke.box; stroke = null;
  if (!b) return;
  undoStack.push({ x: b[0], y: b[1], data: snctx.getImageData(b[0], b[1], b[2] - b[0], b[3] - b[1]) });
  if (undoStack.length > 15) undoStack.shift();
  updateUndo();
}
stage.addEventListener("pointerup", endStroke);
stage.addEventListener("pointercancel", endStroke);
stage.addEventListener("pointerleave", () => { if (!stroke) ring.hidden = true; });

function undo() {
  const s = undoStack.pop();
  if (!s) return;
  mctx.putImageData(s.data, s.x, s.y);
  refresh(s.x, s.y, s.data.width, s.data.height);
  updateUndo();
}
undoBtn.addEventListener("click", undo);
$("resetEdits").addEventListener("click", resetMask);
document.addEventListener("keydown", (e) => {
  if (mode === "edit" && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
});

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
  setMode("compare"); work.hidden = true; status.hidden = true; drop.hidden = false; fileInput.value = "";
});

$("download").addEventListener("click", () => {
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
  ctx.drawImage(canvas, 0, 0);
  c.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "cutout.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
});
