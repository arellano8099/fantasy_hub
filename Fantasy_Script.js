// Read previously selected player names from this browser's local storage.
// A Set makes it easy to check, add, and remove player names.
const savedPlayers = new Set(
  JSON.parse(localStorage.getItem("selectedPlayers") || "[]")
);

// Save the current selection so it remains after refreshing or reopening the page.
function saveSelectedPlayers() {
  localStorage.setItem("selectedPlayers", JSON.stringify([...savedPlayers]));
}

// Player data used to create the cards in the tier board.
const players = [
  { name: "Justin Jefferson", position: "WR", team: "MIN", adp: "2.1", tier: "tier1", tags: ["value"] },
  { name: "Ja'Marr Chase", position: "WR", team: "CIN", adp: "1.8", tier: "tier1", tags: [] },
  { name: "Bijan Robinson", position: "RB", team: "ATL", adp: "3.0", tier: "tier1", tags: [] },
  { name: "Jayden Daniels", position: "QB", team: "WAS", adp: "18.5", tier: "tier2", tags: ["value"] },
  { name: "Brock Bowers", position: "TE", team: "LV", adp: "24.0", tier: "myGuys", tags: ["my-guy"] },
  { name: "Tetairoa McMillan", position: "WR", team: "CAR", adp: "54.0", tier: "tier3", tags: ["value"] },
  { name: "Rome Odunze", position: "WR", team: "CHI", adp: "48.0", tier: "tier4", tags: [] },
  { name: "Chase Brown", position: "RB", team: "CIN", adp: "37.0", tier: "tier2", tags: ["value"] }
];

// Number of players currently selected for the draft.
let draftedCount = 0;

// Position totals displayed in the roster construction card.
const roster = {
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0
};

// Create a card for every player and add it to the appropriate tier column.
function loadPlayers() {
  players.forEach((player) => {
    // Create the HTML element that represents this player.
    const card = document.createElement("div");
    card.className = "player-card";
    card.draggable = true;

    // Restore the selected appearance and roster totals for previously saved players.
    if (savedPlayers.has(player.name)) {
      card.classList.add("drafted");
      roster[player.position]++;
      draftedCount++;
    }

    // Fill the card with the player's details and any tags.
    card.innerHTML = `
      <div class="player-name">${player.name}</div>
      <div class="player-info">${player.position} &bull; ${player.team}</div>
      <div class="player-info">ADP: ${player.adp}</div>
      <div class="badges">
        <span class="badge ${player.position.toLowerCase()}">${player.position}</span>
        ${player.tags.map((tag) => `
          <span class="badge ${tag}">${tag.toUpperCase()}</span>
        `).join("")}
      </div>
    `;

    // Toggle this player between selected and unselected when the card is clicked.
    card.addEventListener("click", () => {
      if (!card.classList.contains("drafted")) {
        // Mark the player as selected and update the matching position total.
        card.classList.add("drafted");
        roster[player.position]++;
        draftedCount++;
        savedPlayers.add(player.name);
      } else {
        // Unselect the player and reverse the roster changes.
        card.classList.remove("drafted");
        roster[player.position]--;
        draftedCount--;
        savedPlayers.delete(player.name);
      }

      // Persist the selection and refresh the visual roster information.
      saveSelectedPlayers();
      updateRoster();
    });

    // Remember which card is being dragged before it is dropped into a new tier.
    card.addEventListener("dragstart", () => {
      draggedCard = card;
    });

    // Insert the completed card into the tier whose ID is stored on the player.
    document.getElementById(player.tier).appendChild(card);
  });
}

// Card currently being moved through drag and drop; null when nothing is dragged.
let draggedCard = null;

// Build cards first, then show the correct restored roster totals.
loadPlayers();
updateRoster();

// Allow every tier column to accept dropped player cards.
const tierLists = document.querySelectorAll(".tier-list");

tierLists.forEach((list) => {
  // Prevent the browser default so the drop event is permitted.
  list.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  // Move the active card into the tier where it was dropped.
  list.addEventListener("drop", () => {
    if (draggedCard) {
      list.appendChild(draggedCard);
    }
  });
});

// Filter player cards based on the text typed in the search field.
function searchPlayers() {
  const value = document.getElementById("playerSearch").value.toLowerCase();
  const cards = document.querySelectorAll(".player-card");

  cards.forEach((card) => {
    // Show matching cards and hide cards that do not match.
    card.style.display = card.innerText.toLowerCase().includes(value) ? "block" : "none";
  });
}

// Update all roster counters, draft progress, and warnings.
function updateRoster() {
  document.getElementById("qb").textContent = roster.QB;
  document.getElementById("rb").textContent = roster.RB;
  document.getElementById("wr").textContent = roster.WR;
  document.getElementById("te").textContent = roster.TE;

  // Display the selected-player total out of the 18-pick target.
  document.getElementById("draftRounds").textContent = `${draftedCount} / 18 Picks`;

  // Set the progress-bar width as a percentage of 18 total picks.
  const percent = (draftedCount / 18) * 100;
  document.getElementById("progressFill").style.width = `${percent}%`;

  updateDraftedPlayersList();
  checkRoster();
}

// Show the names of all selected players in the roster construction panel.
function updateDraftedPlayersList() {
  const draftedPlayersList = document.getElementById("draftedPlayersList");
  const draftedPlayers = players.filter((player) => savedPlayers.has(player.name));

  // Display a helpful message until the first player is selected.
  if (draftedPlayers.length === 0) {
    draftedPlayersList.innerHTML = "<li>No players selected yet.</li>";
    return;
  }

  // Create one list item with the player's name, position, and team.
  draftedPlayersList.innerHTML = draftedPlayers.map((player) => `
    <li><strong>${player.name}</strong> <span>${player.position} &bull; ${player.team}</span></li>
  `).join("");
}

// Create roster-construction warnings based on selection totals.
function checkRoster() {
  const warnings = [];

  // Warn when a position exceeds its recommended maximum.
  if (roster.QB > 3) warnings.push("Too many QBs");
  if (roster.RB > 6) warnings.push("Too many RBs");
  if (roster.WR > 9) warnings.push("Too many WRs");
  if (roster.TE > 3) warnings.push("Too many TEs");

  // Warn about missing or insufficient positions later in the draft.
  if (draftedCount >= 10 && roster.QB === 0) warnings.push("Draft a QB soon");
  if (draftedCount >= 10 && roster.TE === 0) warnings.push("Draft a TE soon");
  if (draftedCount >= 12 && roster.WR < 5) warnings.push("You're behind at WR");

  // Display each warning on its own line, or leave the area empty if none apply.
  document.getElementById("warning").innerHTML = warnings.join("<br>");
}
