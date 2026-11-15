// Pinned version: update it when you want a newer release.
import { removeBackground } from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm";

const $ = (id) => document.getElementById(id);
const drop = $("drop"), fileInput = $("file"), status = $("status"), statusText = $("statusText"),
      barFill = $("barFill"), work = $("work"), before = $("before"), after = $("after"),
      afterBox = $("afterBox"), stage = $("stage"), slider = $("slider");

let srcUrl = null, cutUrl = null, bg = "transparent";

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
      // progress fires for both model downloads and processing steps
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

function setPos(v) { stage.style.setProperty("--pos", v + "%"); }
slider.addEventListener("input", () => setPos(slider.value));

function setBg(value) {
  bg = value;
  afterBox.classList.toggle("checker", value === "transparent");
  afterBox.style.background = value === "transparent" ? "" : value;
  document.querySelectorAll("#swatches .sw[data-bg]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.bg === value)));
}
document.querySelectorAll("#swatches .sw[data-bg]").forEach(b => b.addEventListener("click", () => setBg(b.dataset.bg)));
$("custom").addEventListener("input", (e) => setBg(e.target.value));

$("again").addEventListener("click", () => { work.hidden = true; status.hidden = true; drop.hidden = false; fileInput.value = ""; });

$("download").addEventListener("click", () => {
  const c = document.createElement("canvas");
  c.width = after.naturalWidth; c.height = after.naturalHeight;
  const ctx = c.getContext("2d");
  if (bg !== "transparent") { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(after, 0, 0);
  c.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "cutout.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
});
