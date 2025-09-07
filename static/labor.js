document.addEventListener("DOMContentLoaded", () => {
  const laborParts = [
    { name: "Front Bumper", job: "Paint", cost: "$300" },
    { name: "Rear Bumper", job: "Paint", cost: "$300" },
    { name: "Door Rear", job: "Paint + Dents Repair", cost: "$300" },
    { name: "Fender", job: "Paint + Dents Repair", cost: "$300" },
    { name: "Door Front", job: "Paint + Dents Repair", cost: "$300" },
    { name: "Hood", job: "Paint + Dents Repair", cost: "$400" },
    { name: "Roof", job: "Paint + Dents Repair", cost: "$500" }
  ];

  const resultsContainer = document.getElementById("results");

  laborParts.forEach(part => {
    const card = document.createElement("div");
    card.className = "part-card";

    const image = document.createElement("img");
    image.className = "part-image";
    
    const fileName = part.name.toLowerCase().replace(/\s+/g, '_') + '.png';
    image.src = `/static/images/${fileName}`;
    image.alt = part.name;

    image.onerror = () => {
      image.src = '/static/images/default.png';
    };

    const name = document.createElement("div");
    name.className = "part-name";
    name.textContent = part.name;

    const job = document.createElement("p");
    job.className = "part-info";
    job.innerHTML = `<strong>Job:</strong> ${part.job}`;

    const cost = document.createElement("p");
    cost.className = "part-info";
    cost.innerHTML = `<strong>Cost:</strong> ${part.cost}`;

    card.appendChild(image);
    card.appendChild(name);
    card.appendChild(job);
    card.appendChild(cost);

    resultsContainer.appendChild(card);
  });
});