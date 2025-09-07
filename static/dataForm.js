// static/js/dataform.js

/* ---------- VARs ---------- */
const yearInp  = document.getElementById("yearInput");
const makeInp  = document.getElementById("makeInput");
const modelInp = document.getElementById("modelInput");
const trimInp  = document.getElementById("trimInput");
const checkBtn = document.getElementById("check-btn");
const submitBtn= document.getElementById("submit");

/* ---------- Years Range VARs ---------- */
const yearFromEl   = document.getElementById("yearFromInput");
const yearToEl     = document.getElementById("yearToInput");
const makeAddEl    = document.getElementById("makeAddInput");
const modelAddEl   = document.getElementById("modelAddInput");
const trimAddEl    = document.getElementById("trimAddInput");
const addBtn       = document.getElementById("add-btn");




/* ---------- helpers ---------- */
function toSnakeCase(s){ return s.trim().toLowerCase().replace(/\s+/g, "_"); }

function clearInvalid(el){ el.classList.remove('error-shake'); }

function markInvalid(el){
  
  el.classList.remove('error-shake');
  void el.offsetWidth;               
  el.classList.add('error-shake');   
}
function clearInvalid(el){ el.classList.remove("error-shake"); el.style.borderColor=""; }
function setInvalid(el){ el.classList.add("error-shake"); el.style.borderColor="red"; }
const capWords = s => s.trim().split(/\s+/).map(w=>w[0]?.toUpperCase()+w.slice(1).toLowerCase()).join(" ");

function validateRequired(...fields){
  let ok = true;
  fields.forEach(f => {
    if (!f.value.trim()){ markInvalid(f); ok = false; }
    else { clearInvalid(f); }
  });
  return ok;
}

// remove red border when user types
[yearInp, makeInp, modelInp, trimInp].forEach(el => {
  el.addEventListener("input", () => clearInvalid(el));
});

// Title-case words, preserving hyphens: "mercedes-benz" -> "Mercedes-Benz"
function toTitleCase(str) {
  return str.trim().split(/\s+/).map(word =>
    word.split("-").map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w).join("-")
  ).join(" ");
}

// Join model words in CamelCase without spaces: "rav 4" -> "Rav4", "cx 5" -> "Cx5"
function capJoinModel(model) {
  return model.trim().split(/\s+/)
    .map(w => w[0] ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
    .join('');
}

// Firestore doc id under make_model_parts: "toyotaCamry"
function buildMakeModelId(makeRaw, modelRaw){
  const makeId  = makeRaw.trim().toLowerCase();
  const modelId = capJoinModel(modelRaw);
  return makeId + modelId;
}

// Normalize in one place and write back to inputs so user sees it
function getNormalizedInputs() {
  const year  = yearInp.value.trim();
  const make  = toTitleCase(makeInp.value);
  const model = toTitleCase(modelInp.value);
  const trim  = trimInp.value.trim().toUpperCase();

  makeInp.value  = make;
  modelInp.value = model;
  trimInp.value  = trim;

  return { year, make, model, trim };
}

// Basic validation
function validateFourInputs({year, make, model, trim}) {
  if (!year || !make || !model || !trim) {
    alert("Please enter: Year, Make, Model, and Trim");
    return false;
  }
  if (!/^\d{4}$/.test(year)) {
    alert("Year must be 4 digits (e.g. 2023).");
    return false;
  }
  return true;
}

/* ---------- normalize on blur ---------- */
[makeInp, modelInp].forEach(inp => inp.addEventListener("blur", () => {
  inp.value = toTitleCase(inp.value);
}));
trimInp.addEventListener("blur", () => { trimInp.value = trimInp.value.trim().toUpperCase(); });

/* ---------- "Check" button -> /api/added-vehicles ---------- */
checkBtn.addEventListener("click", async (e) => {
  e.preventDefault();
if (!validateRequired(yearInp, makeInp, modelInp, trimInp)) {
   
    return;
  }

  const year   = yearInp.value.trim();
  const makeRaw  = makeInp.value.trim();
  const modelRaw = modelInp.value.trim();
  const trimRaw  = trimInp.value.trim();

  // client-side normalization
  const makeId = makeRaw.toLowerCase(); // used for lookups
  const model  = modelRaw.replace(/\s+/g,' ').trim()
                 .split(' ')
                 .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                 .join(' ');
  const trim   = trimRaw.toUpperCase();

  try {
    const res = await fetch("/api/added-vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, makeId, model, trim })
    });
    const data = await res.json();
    if (res.status === 201) alert("✅ Added to database");
    else if (data.status === "exists") alert("Already added.");
    else alert(data.error || "Failed.");
  } catch (e) {
    console.error(e);
    alert("Request failed.");
  }
});
addBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  [yearFromEl, yearToEl, makeAddEl, modelAddEl, trimAddEl].forEach(clearInvalid);

  const yearFrom = yearFromEl.value.trim();
  const yearTo   = yearToEl.value.trim();
  const make     = makeAddEl.value.trim();
  const model    = modelAddEl.value.trim();
  const trim     = trimAddEl.value.trim();

  let ok = true;
  if (!/^\d{4}$/.test(yearFrom)) { setInvalid(yearFromEl); ok=false; }
  if (!/^\d{4}$/.test(yearTo))   { setInvalid(yearToEl); ok=false; }
  if (!make)  { setInvalid(makeAddEl);  ok=false; }
  if (!model) { setInvalid(modelAddEl); ok=false; }
  if (!trim)  { setInvalid(trimAddEl);  ok=false; }
  if (!ok) { alert("Please complete all fields correctly."); return; }

  if (parseInt(yearFrom,10) > parseInt(yearTo,10)) {
    setInvalid(yearFromEl); setInvalid(yearToEl);
    alert("Year From must be less than or equal to Year To");
    return;
  }

  const payload = {
    yearFrom,
    yearTo,
    make,                           // backend will map to display or title-case
    model: capWords(model),         
    trim: trim.toUpperCase()        // enforce caps
  };

  try {
    const res = await fetch("/api/added-vehicles-range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok) {
      alert(`✅ Added ${data.created} year(s). Skipped ${data.skipped_existing} existing.`);
    } else {
      alert(data.error || "Failed to add vehicles.");
    }
  } catch (err) {
    console.error(err);
    alert("Request failed.");
  }
});
/* ---------- Submit parts -> /api/parts ---------- */
submitBtn.addEventListener("click", async (e) => {
  e.preventDefault();

  const { year, make, model, trim } = getNormalizedInputs();
  if (!validateFourInputs({year, make, model, trim})) return;

  const makeModelId = buildMakeModelId(make, model);
  const compatibleTrims = [trim];

  const rows = document.querySelectorAll(".parts-section .part-row");
  const payload = [];
  let ok = true;

  rows.forEach((row) => {
    const label = row.querySelector("label")?.textContent.trim();
    const inputs = Array.from(row.querySelectorAll("input"));
    const values = inputs.map(i => i.value.trim());
    const allEmpty = values.every(v => v === "");
    const allFilled= values.every(v => v !== "");

    inputs.forEach(i => { i.classList.remove("error-shake"); i.style.borderColor = ""; });

    if (allEmpty) return;
    if (!allFilled) {
      ok = false;
      inputs.forEach(i => { if (!i.value.trim()) { i.classList.add("error-shake"); i.style.borderColor = "red"; }});
      return;
    }

    const [priceFromStr, priceToStr, partNumber, yearFromStr, yearToStr] = values;
    const priceFrom = parseFloat(priceFromStr);
    const priceTo   = parseFloat(priceToStr);
    const yearFrom  = parseInt(yearFromStr, 10);
    const yearTo    = parseInt(yearToStr, 10);

    if (isNaN(priceFrom) || isNaN(priceTo) || isNaN(yearFrom) || isNaN(yearTo) ||
        yearFrom > yearTo || priceFrom > priceTo) {
      ok = false;
      alert(`Invalid input in row for "${label}". Check numbers and ranges.`);
      return;
    }

    payload.push({
      make: makeModelId,
      trim,
      part: toSnakeCase(label),
      part_name: label,
      priceFrom, priceTo,
      partNumber,
      yearFrom, yearTo,
      compatibleTrims
    });
  });

  if (!ok) {
    alert("Please complete all fields in any partially filled row.");
    return;
  }

  try {
    const res = await fetch("/api/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ Parts uploaded. Created: ${data.written}, Updated: ${data.updated}`);
    } else {
      alert(data.error || "Upload failed");
    }
  } catch (e) {
    console.error(e);
    alert("Request failed.");
  }
});

