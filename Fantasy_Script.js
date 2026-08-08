// Read previously selected player names from this browser's local storage.
// A Set makes it easy to check, add, and remove player names.
const savedPlayers = new Set(
  JSON.parse(localStorage.getItem("selectedPlayers") || "[]")
);

// Save the current selection so it remains after refreshing or reopening the page.
function saveSelectedPlayers() {
  localStorage.setItem("selectedPlayers", JSON.stringify([...savedPlayers]));
}

// Default player data used to create the cards in the tier board.
const defaultPlayers = [
  { name: "Justin Jefferson", position: "WR", team: "MIN", adp: "2.1", tier: "tier1", tags: ["value"] },
  { name: "Ja'Marr Chase", position: "WR", team: "CIN", adp: "1.8", tier: "tier1", tags: [] },
  { name: "Bijan Robinson", position: "RB", team: "ATL", adp: "3.0", tier: "tier1", tags: [] },
  { name: "Jayden Daniels", position: "QB", team: "WAS", adp: "18.5", tier: "tier2", tags: ["value"] },
  { name: "Brock Bowers", position: "TE", team: "LV", adp: "24.0", tier: "myGuys", tags: ["my-guy"] },
  { name: "Tetairoa McMillan", position: "WR", team: "CAR", adp: "54.0", tier: "tier3", tags: ["value"] },
  { name: "Rome Odunze", position: "WR", team: "CHI", adp: "48.0", tier: "tier4", tags: [] },
  { name: "Chase Brown", position: "RB", team: "CIN", adp: "37.0", tier: "tier2", tags: ["value"] }
];

// Players added through the form are saved separately from the default list.
const CUSTOM_PLAYERS_KEY = "customTierPlayers";
const HIDDEN_PLAYERS_KEY = "hiddenTierPlayers";
// Remove duplicate custom names left behind by older versions of the add-player form.
const customPlayers = JSON.parse(localStorage.getItem(CUSTOM_PLAYERS_KEY) || "[]").filter((player, index, list) =>
  !defaultPlayers.some((defaultPlayer) => defaultPlayer.name.toLowerCase() === player.name.toLowerCase()) &&
  list.findIndex((item) => item.name.toLowerCase() === player.name.toLowerCase()) === index
);
localStorage.setItem(CUSTOM_PLAYERS_KEY, JSON.stringify(customPlayers));
const hiddenPlayers = new Set(JSON.parse(localStorage.getItem(HIDDEN_PLAYERS_KEY) || "[]"));
let players = [...defaultPlayers, ...customPlayers];

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
  // Clear old cards and recalculate totals when the board is rebuilt.
  document.querySelectorAll(".tier-list").forEach((list) => { list.innerHTML = ""; });
  draftedCount = 0;
  Object.keys(roster).forEach((position) => { roster[position] = 0; });

  // Old local or cloud data can contain duplicates; show only the first card per name.
  const displayedPlayerNames = new Set();
  players.filter((player) => {
    const nameKey = player.name.trim().toLowerCase();
    if (hiddenPlayers.has(player.name) || displayedPlayerNames.has(nameKey)) return false;
    displayedPlayerNames.add(nameKey);
    return true;
  }).forEach((player) => {
    // Create the HTML element that represents this player.
    const card = document.createElement("div");
    card.className = "player-card";
    card.draggable = true;
    card.dataset.playerName = player.name;

    // Restore the selected appearance and roster totals for previously saved players.
    if (savedPlayers.has(player.name)) {
      card.classList.add("drafted");
      roster[player.position]++;
      draftedCount++;
    }

    // Fill the card with the player's details and any tags.
    card.innerHTML = `
      <button class="remove-player" type="button" aria-label="Remove ${player.name} from board">&times;</button>
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

    // Remove a player without also triggering the card's draft-selection click.
    card.querySelector(".remove-player").addEventListener("click", (event) => {
      event.stopPropagation();
      hiddenPlayers.add(player.name);
      savedPlayers.delete(player.name);
      const customIndex = customPlayers.indexOf(player);
      if (customIndex !== -1) customPlayers.splice(customIndex, 1);
      localStorage.setItem(HIDDEN_PLAYERS_KEY, JSON.stringify([...hiddenPlayers]));
      localStorage.setItem(CUSTOM_PLAYERS_KEY, JSON.stringify(customPlayers));
      saveSelectedPlayers();
      document.dispatchEvent(new CustomEvent("draftplayerremoved", { detail: { player, isCustom: customIndex !== -1 } }));
      loadPlayers();
      updateRoster();
    });

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

      // Remember the new tier for custom players after the page is refreshed.
      const movedPlayer = players.find((player) => player.name === draggedCard.dataset.playerName);
      if (movedPlayer && customPlayers.includes(movedPlayer)) {
        movedPlayer.tier = list.id;
        localStorage.setItem(CUSTOM_PLAYERS_KEY, JSON.stringify(customPlayers));
      }
    }
  });
});

// Open and close the quick-add player dialog.
const addPlayerDialog = document.getElementById("addPlayerDialog");
document.getElementById("openAddPlayer").addEventListener("click", () => {
  document.getElementById("addPlayerError").textContent = "";
  addPlayerDialog.showModal();
  document.getElementById("newPlayerName").focus();
});

document.getElementById("closeAddPlayer").addEventListener("click", () => addPlayerDialog.close());

// Add the entered player, save them locally, and rebuild the board.
document.getElementById("addPlayerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("newPlayerName").value.trim();
  const error = document.getElementById("addPlayerError");

  // A removed player may be added again; only visible players count as duplicates.
  if (players.some((player) => player.name.toLowerCase() === name.toLowerCase() && !hiddenPlayers.has(player.name))) {
    error.textContent = "That player is already on the tier board.";
    return;
  }

  const tags = document.getElementById("newPlayerTags").value
    .split(",")
    .map((tag) => tag.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean);
  const player = {
    name,
    position: document.getElementById("newPlayerPosition").value,
    team: document.getElementById("newPlayerTeam").value.trim().toUpperCase(),
    adp: document.getElementById("newPlayerAdp").value || "—",
    tier: document.getElementById("newPlayerTier").value,
    tags
  };

  // Restore the original hidden player rather than creating a second copy.
  const removedPlayer = players.find((item) => item.name.toLowerCase() === name.toLowerCase());
  let playerToSave = player;
  if (removedPlayer) {
    Object.assign(removedPlayer, player);
    playerToSave = removedPlayer;
    // A removed custom player was taken out of the saved custom list; add it back.
    if (!defaultPlayers.includes(removedPlayer) && !customPlayers.includes(removedPlayer)) {
      customPlayers.push(removedPlayer);
    }
  } else {
    customPlayers.push(player);
    players.push(player);
  }

  // Re-adding a previously removed name makes the card visible again.
  hiddenPlayers.delete(name);
  localStorage.setItem(HIDDEN_PLAYERS_KEY, JSON.stringify([...hiddenPlayers]));
  localStorage.setItem(CUSTOM_PLAYERS_KEY, JSON.stringify(customPlayers));
  event.target.reset();
  addPlayerDialog.close();
  loadPlayers();
  updateRoster();
  document.dispatchEvent(new CustomEvent("draftplayeradded", { detail: { player: playerToSave } }));
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
  const listedPlayerNames = new Set();
  const draftedPlayers = players.filter((player) => {
    const nameKey = player.name.trim().toLowerCase();
    if (!savedPlayers.has(player.name) || hiddenPlayers.has(player.name) || listedPlayerNames.has(nameKey)) return false;
    listedPlayerNames.add(nameKey);
    return true;
  });

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
