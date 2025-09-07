const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
const MAKES = [
  { id: "toyota",    name: "Toyota" },
  { id: "honda",     name: "Honda" },
  { id: "ford",      name: "Ford" },
  { id: "lexus",     name: "Lexus" },
  { id: "chevrolet", name: "Chevrolet" },
  { id: "nissan", name: "Nissan" },
  { id: "gmc",       name: "GMC" }
];

// ====== VARs ======
const yearSel   = document.getElementById("yearSelect");
const makeSel   = document.getElementById("makeSelect");
const modelSel  = document.getElementById("modelSelect");
const trimSel   = document.getElementById("trimSelect");
const searchBtn = document.getElementById("search-button");
const laborBtn  = document.getElementById("labor-button");

// ====== helpers ======
function formatModel(model) {
  if (!model) return "";

  // Split on whitespace, filter out empty strings
  const parts = model.trim().split(/\s+/);
  // Capitalize each part
  const formatted = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  // Join without spaces
  return formatted.join("");
}
function resetSelect(sel, placeholder, disabled = true) {
  sel.innerHTML = "";
  const o = document.createElement("option");
  o.value = "";
  o.textContent = placeholder;
  sel.appendChild(o);
  sel.disabled = disabled;
}

function addOption(sel, value, label) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  sel.appendChild(o);
}

function populateYears() {
  resetSelect(yearSel, "Year", false);
  YEARS.forEach(y => addOption(yearSel, String(y), String(y)));
}

function populateMakes() {
  resetSelect(makeSel, "Make", false);
  MAKES.forEach(m => addOption(makeSel, m.id, m.name));
}

function makeLabelFromId(id) {
  const m = MAKES.find(x => x.id === id);
  return m ? m.name : id;
}

function clearInvalid(el) {
  el.classList.remove("error-shake");
  el.style.borderColor = "";
}

function setInvalid(el) {
  el.classList.add("error-shake");
  el.style.borderColor = "red";
}

function showAlert(message) {
  const container = document.getElementById("alertBoxContainer");
  if (!container) { alert(message); return; }
  container.innerHTML = `
    <div id="alertBox" style="background:#f8d7da;width:260px;color:#721c24;padding:10px;border:1px solid #f5c6cb;border-radius:5px;position:relative;">
      ${message}
      <span onclick="document.getElementById('alertBox').style.display='none'"
            style="position:absolute;right:10px;top:5px;cursor:pointer;">&times;</span>
    </div>`;
}

// ====== API calls ======
async function fetchModels(makeId) {
  const res = await fetch(`/api/car-models?make=${encodeURIComponent(makeId)}`);
  if (!res.ok) throw new Error("Failed to load models");
  return res.json(); // [{id, name}, ...]
}

async function fetchTrims(makeId, modelName) {
  const url = `/api/car-trims?make=${encodeURIComponent(makeId)}&model=${encodeURIComponent(modelName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load trims");
  return res.json(); // ["LE","SE",...]
}
async function loadVehicleCount() {
  const el = document.getElementById("db-stats");
  if (!el) return;

  try {
    const res = await fetch("/api/vehicle-count");
    if (!res.ok) throw new Error("bad response");
    const { count } = await res.json();
    const noun = count === 1 ? "car" : "cars";
    el.textContent = `We currently have ${count} ${noun} in our database.`;
  } catch {
    el.textContent = ""; 
  }
}

// ====== init ======
document.addEventListener("DOMContentLoaded", () => {
  // 1) Years
  populateYears();
  loadVehicleCount();

  // 2) Lock selects & set placeholders
  resetSelect(makeSel,  "Make");
  resetSelect(modelSel, "Model");
  resetSelect(trimSel,  "Trim");

  // 3) Enforce order Year -> Make -> Model -> Trim
  yearSel.addEventListener("change", () => {
    clearInvalid(yearSel);

    // reset downstream
    resetSelect(makeSel,  "Make");
    resetSelect(modelSel, "Model");
    resetSelect(trimSel,  "Trim");

    if (yearSel.value) {
      populateMakes();              // show hard-coded makes
    } else {
      makeSel.disabled  = true;
      modelSel.disabled = true;
      trimSel.disabled  = true;
    }
  });

  makeSel.addEventListener("change", async () => {
    clearInvalid(makeSel);

    resetSelect(modelSel, "Model");
    resetSelect(trimSel,  "Trim");

    const makeId = makeSel.value;
    if (!makeId) return;

    try {
      const models = await fetchModels(makeId);
      models.forEach(m => addOption(modelSel, m.name, m.name));
      modelSel.disabled = models.length === 0;
    } catch (e) {
      console.error(e);
      showAlert("Failed to load models.");
    }
  });

  modelSel.addEventListener("change", async () => {
    clearInvalid(modelSel);

    resetSelect(trimSel, "Trim");

    const makeId    = makeSel.value;
    const modelName = modelSel.value;
    if (!makeId || !modelName) return;

    try {
      const trims = await fetchTrims(makeId, modelName);
      trims.forEach(t => addOption(trimSel, t, t));
      trimSel.disabled = trims.length === 0;
    } catch (e) {
      console.error(e);
      showAlert("Failed to load trims.");
    }
  });

  trimSel.addEventListener("change", () => clearInvalid(trimSel));

  // 4) Search
  searchBtn.addEventListener("click", async () => {
    // Basic validation + red borders
    let ok = true;
    [yearSel, makeSel, modelSel, trimSel].forEach(clearInvalid);

    if (!yearSel.value)  { ok = false; setInvalid(yearSel); }
    if (!makeSel.value)  { ok = false; setInvalid(makeSel); }
    if (!modelSel.value) { ok = false; setInvalid(modelSel); }
    if (!trimSel.value)  { ok = false; setInvalid(trimSel); }

    if (!ok) {
      showAlert("Please select Year, Make, Model, and Trim.");
      return;
    }

    const year      = yearSel.value;
    const makeLabel = makeLabelFromId(makeSel.value); // e.g., "Toyota"
    const model     = formatModel(modelSel.value); // e.g., "Camry"
    const trim      = trimSel.value.toUpperCase();    // enforce uppercase

    const vehicleStr = `${year} ${makeLabel} ${model} ${trim}`;
   
    try {
      const resp = await fetch("/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle: vehicleStr })
      });
      const data = await resp.json();

      if (resp.ok) {
        if (!Array.isArray(data) || data.length === 0) {
          showAlert("Sorry, no compatible parts found for this vehicle.");
        } else {
          localStorage.setItem("partsResult", JSON.stringify(data));
          window.location.href = "/result";
        }
      } else {
        showAlert(data.error || "Failed to search parts.");
      }
    } catch (err) {
      console.error(err);
      showAlert("Something went wrong.");
    }
  });

  // 5) Labor Cost navigation
  if (laborBtn) {
    laborBtn.addEventListener("click", () => {
      window.location.href = "/laborCost";
    });
  }
});
