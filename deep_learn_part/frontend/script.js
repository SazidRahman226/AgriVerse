const API_URL = "http://localhost:5000/predict";

const fileInput = document.getElementById("file");
const imgPreview = document.getElementById("imgPreview");
const croppedPreview = document.getElementById("croppedPreview");

const cropBtn = document.getElementById("cropBtn");
const predictBtn = document.getElementById("predictBtn");

const statusEl = document.getElementById("status");
const predEl = document.getElementById("pred");
const confEl = document.getElementById("conf");

let cropper = null;
let croppedBlob = null;

function resetOutput() {
  predEl.textContent = "—";
  confEl.textContent = "—";
  statusEl.textContent = "";
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];

  resetOutput();
  croppedBlob = null;

  croppedPreview.style.display = "none";
  croppedPreview.src = "";

  if (!file) return;

  const url = URL.createObjectURL(file);
  imgPreview.src = url;
  imgPreview.style.display = "block";

  // reset cropper
  if (cropper) cropper.destroy();

  cropper = new Cropper(imgPreview, {
    viewMode: 1,
    autoCropArea: 0.8,
    responsive: true,
    background: false
  });

  cropBtn.disabled = false;
  predictBtn.disabled = true;
});

cropBtn.addEventListener("click", async () => {
  if (!cropper) return;

  statusEl.textContent = "Cropping...";
  predEl.textContent = "—";
  confEl.textContent = "—";

  const canvas = cropper.getCroppedCanvas({
    width: 224,
    height: 224
  });

  canvas.toBlob((blob) => {
    croppedBlob = blob;

    const previewUrl = URL.createObjectURL(blob);
    croppedPreview.src = previewUrl;
    croppedPreview.style.display = "block";

    statusEl.textContent = "Cropped ✅ Now click Predict.";
    predictBtn.disabled = false;
  }, "image/jpeg", 0.95);
});

predictBtn.addEventListener("click", async () => {
  if (!croppedBlob) {
    statusEl.textContent = "Please crop the leaf first.";
    return;
  }

  predictBtn.disabled = true;
  cropBtn.disabled = true;
  statusEl.textContent = "Uploading cropped leaf & predicting...";

  try {
    const formData = new FormData();
    formData.append("image", croppedBlob, "leaf.jpg");

    const res = await fetch(API_URL, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Prediction failed");

    // ✅ NEW: if backend says NOT leaf
    if (data.is_leaf === false) {
      predEl.textContent = "Not a leaf ❌";
      confEl.textContent = "—";
      statusEl.textContent = "Please upload a clear leaf photo.";
      return;
    }

    // ✅ Leaf is valid -> show disease prediction
    predEl.textContent = data.prediction ?? "Unknown";
    confEl.textContent = (data.confidence == null)
      ? "N/A"
      : (data.confidence * 100).toFixed(2) + "%";

    statusEl.textContent = "Done ✅";

  } catch (e) {
    statusEl.textContent = "Error: " + e.message;
  } finally {
    predictBtn.disabled = false;
    cropBtn.disabled = false;
  }
});
