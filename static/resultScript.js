document.addEventListener("DOMContentLoaded", () => {
  const rawData = localStorage.getItem("partsResult");

  if (!rawData) {
    document.getElementById("results").innerHTML = "<p>No parts found.</p>";
    return;
  }

  const parts = JSON.parse(rawData);
  console.log(" Parts loaded from storage:", parts); 

  const resultsContainer = document.getElementById("results");

  parts.forEach(part => {
    const card = document.createElement("div");
    card.className = "part-card";

    const img = document.createElement("img");
    img.className = "part-image";
    let partName = (part.partName || "").toLowerCase().replace(/\s+/g, "_");
    img.src = `/static/images/${partName}.png`;
    img.onerror = () => img.src = '/static/images/default.png';

    const name = document.createElement("h3");
    name.className = "part-name";
    name.textContent = part.partName || part.id;

    const oem = document.createElement("p");
    oem.className = "part-info";
    oem.innerHTML = `<strong>OEM Part #:</strong> ${part.oem_part_number || 'N/A'}`;

    const price = document.createElement("p");
    price.className = "part-info";
    price.innerHTML = `<strong>Price:</strong> $${part.price_from} - $${part.price_to}`;

    const years = document.createElement("p");
    years.className = "part-info years";
    years.innerHTML = `<strong>Years:</strong> ${part.compatible_years.join(', ')}`;

    const trims = document.createElement("p");
    trims.className = "part-info";
    trims.innerHTML = `<strong>Trims:</strong> ${part.compatible_trims.join(', ')}`;

    card.appendChild(img);
    card.appendChild(name);
    card.appendChild(oem);
    card.appendChild(price);
    card.appendChild(years);
    card.appendChild(trims);

    resultsContainer.appendChild(card);
  });

  localStorage.removeItem('partsResults'); // Cleanup after rendering
});